# Audit packet: RSO / roster optimizer

Master entries M-RSO-001 to M-RSO-060 (60 of 60 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-RSO-001 | Bench decision explanation (forced-placement counterfactual) | Both | 0 | 2 |
| M-RSO-002 | Player contribution ledger (GP/AGP/bench per roster player) | Both | 0 | 1 |
| M-RSO-003 | Roster schedule evaluation (bench games, DUST rate, slot utilization) | Both | 0 | 5 |
| M-RSO-004 | Plan evaluation totals (scheduled, active, bench games, projected val… | Both | 0 | 5 |
| M-RSO-005 | Candidate plan ordering and alternative display rule | Both | 0 | 2 |
| M-RSO-006 | Candidate plan metrics (Best Fit swaps) | Both | 0 | 3 |
| M-RSO-007 | Streaming best-player-available ranking (blended FPts score) | Both | 0 | 5 |
| M-RSO-008 | Category plan dominance relation | Both | 0 | 3 |
| M-RSO-009 | Opponent positional tilt (F vs D share allowed) | Both | 0 | 3 |
| M-RSO-010 | Legacy naive team win probability (Poisson) | Both | 0 | 4 |
| M-RSO-011 | Season per-game rates for stats FORGE does not project | Both | 0 | 4 |
| M-RSO-012 | Power-play zero policy and skater line construction | Both | 0 | 2 |
| M-RSO-013 | FORGE bridge skater line reuse and opponent/rest/tilt retargeting | Both | 0 | 8 |
| M-RSO-014 | Reserve lines and 'no FORGE line' conservative zeros | Both | 0 | 3 |
| M-RSO-015 | Team strength priors blend | Both | 0 | 4 |
| M-RSO-016 | Later-period impact (Delta F rate scenario) | Both | 0 | 5 |
| M-RSO-017 | Bridge goalie per-start line, wins and expected stats | Both | 0 | 6 |
| M-RSO-018 | Bridge goalie start probabilities | Both | 0 | 4 |
| M-RSO-019 | Goalie minimum coverage target and preferred window | Both | 0 | 2 |
| M-RSO-020 | Projected goalie starts and minimum risk | Both | 0 | 2 |
| M-RSO-021 | Yahoo starting-goalie override of start probabilities | Both | 0 | 3 |
| M-RSO-022 | Healthy-reserve activation gain | Both | 0 | 3 |
| M-RSO-023 | Position eligibility normalization and slot compatibility | Both | 0 | 3 |
| M-RSO-024 | Lineup gap report | Both | 0 | 2 |
| M-RSO-025 | DUST daily lineup assignment (min-cost max-flow) | Both | 0 | 3 |
| M-RSO-026 | Planner daily lineup assignment (Hungarian, AGP lexicographic bonus) | Both | 0 | 3 |
| M-RSO-027 | Active roster slot expansion | Both | 0 | 1 |
| M-RSO-028 | Streaming per-day capacity via bipartite matching | Both | 0 | 2 |
| M-RSO-029 | Acquisition timeline, effective time and budget accounting | Both | 0 | 2 |
| M-RSO-030 | Drop retention ordering and ownership caution | Both | 0 | 3 |
| M-RSO-031 | Candidate marginal DUST (Daily Unstartable Schedule Tax) | Both | 0 | 2 |
| M-RSO-032 | Lower-conflict alternative recommendations | Both | 0 | 3 |
| M-RSO-033 | DUST risk classification | Both | 0 | 3 |
| M-RSO-034 | Roster Autopsy slot coverage analysis | Both | 0 | 2 |
| M-RSO-035 | Plan ordering and safe-alternative gate | Both | 0 | 2 |
| M-RSO-036 | Search work quotas | Both | 0 | 2 |
| M-RSO-037 | Schedule fits (marginal active games by team/position group) | Both | 0 | 2 |
| M-RSO-038 | Roster plan beam search (add/drop/reserve sequences) | Both | 0 | 3 |
| M-RSO-039 | Streaming chain window DP (1 vs 2 spots) | Both | 0 | 5 |
| M-RSO-040 | Client bench/dead-day tallies (DustMatrix, BenchDays) | Opus only | 0 | 2 |
| M-RSO-041 | RSO lineup expected-points tercile tiers | Opus only | 0 | 2 |
| M-RSO-042 | RSO streaming itinerary override totals and goalie-minimum tradeoff | Opus only | 0 | 1 |
| M-RSO-043 | Candidate shortlist heuristic | Opus only | 0 | 1 |
| M-RSO-044 | Points comparison 5% similarity display | Opus only | 0 | 1 |
| M-RSO-045 | RSO planning data load and forecast source selection | Opus only | 0 | 2 |
| M-RSO-046 | Bridge forecast transport trimming | Opus only | 0 | 1 |
| M-RSO-047 | Forecast coverage accounting | Opus only | 0 | 0 |
| M-RSO-048 | Unknown-quality contamination and conditional ability tie-break | Opus only | 0 | 2 |
| M-RSO-049 | Outcome lineup local-search refinement | Opus only | 0 | 2 |
| M-RSO-050 | Started-game lock inference | Opus only | 0 | 0 |
| M-RSO-051 | Weekly lineup window aggregation | Opus only | 0 | 0 |
| M-RSO-052 | Schedule preparation and Yahoo week mapping | Opus only | 0 | 1 |
| M-RSO-053 | Latest equivalent action time | Opus only | 0 | 2 |
| M-RSO-054 | Schedule freshness witness and warning thresholds | Opus only | 0 | 1 |
| M-RSO-055 | Period, lineup-window and timezone boundary math | Opus only | 0 | 0 |
| M-RSO-056 | Form label and deployment chips | Opus only | 0 | 2 |
| M-RSO-057 | Intent reconciliation (refresh revalidation and allowance re-spend) | Opus only | 0 | 0 |
| M-RSO-058 | Ownership freshness | Opus only | 0 | 0 |
| M-RSO-059 | Team schedule context (schedule score, off-nights) | Opus only | 0 | 0 |
| M-RSO-060 | Streaming chain certification and ranking | Opus only | 0 | 1 |

## M-RSO-001 Bench decision explanation (forced-placement counterfactual)

- **Match:** Both; Opus RSO-004; Codex roster-bench-counterfactual
- **Purpose:** For each benched player-game, test a legal forced placement and label why he sits.
- **Where:** `web/lib/rosterScheduleOptimizer/benchDecisions.ts:41 (explainBenchDecisions)`; `web/lib/rosterScheduleOptimizer/benchDecisions.ts:15 (reserveBenchEvaluation)`; `web/lib/rosterScheduleOptimizer/planning.ts:1046 (evaluateForced)`; `web/lib/rosterScheduleOptimizer/benchDecisions.ts:41 explainBenchDecisions`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-004):**
  - Method: Score basis: points_assignment (assignmentValue) / category_outcomes (projectedValue) / category_assignment. Skater points: one forced assign with player bonus, delta = sum new row values - sum removed; others: each open slot via full evaluator. Coverage compares min(target, projected). Reason: decision_unresolved if forced improves; minimum_priority; category_tradeoff; equal_lineup_value; negative_value (row value < 0); lower_lineup_value. Budget max(12, floor(250/sqrt(ceil(days/14)))) default 250.
  - Inputs/units: fantasy points (assignmentValue/projectedValue); sources: —
  - Output scale: reason enum + selected vs forced scores (fantasy points); writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves); BenchDecisions.tsx, RosterContribution.tsx
  - Consumers: BenchDecisions.tsx; RosterContribution.tsx; contributionLedger
- **Codex view (roster-bench-counterfactual, calculation, location; Codex family 'roster-planning'):** Bench forced-placement value comparison
  - Purpose: Force an excluded player into each relevant eligible placement, compare legal complete lineup scores and goalie coverage; retain strongest checked placement and slot changes.
  - Inputs/units: Selected evaluation, locks/slots, forced-plan evaluator and bounded budget.
  - Output scale: Selected/forced score evidence, bench reason and competing assignment changes.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): benchDecisions.ts:39-40 ('Reuse the actual evaluator with a hypothetical placement ... receipts describe evaluated placements')
  - Intended contract (Codex roster-bench-counterfactual): Counterfactual whole-lineup explanation; incomplete budget does not certify optimal bench decision. Source: web/lib/rosterScheduleOptimizer/benchDecisions.ts:41 explainBenchDecisions.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/contributionLedger.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`; `{"discovered_not_run": ["web/lib/rosterScheduleOptimizer/planning.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) if the forced placement scores higher the plan is downgraded to schedule_capacity (signals matching non-optimality)
  - (codex:roster-bench-counterfactual) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-002 Player contribution ledger (GP/AGP/bench per roster player)

- **Match:** Both; Opus RSO-005; Codex roster-contribution-ledger
- **Purpose:** Per roster player, count scheduled, active and bench games and projected points under a plan.
- **Where:** `web/lib/rosterScheduleOptimizer/contributionLedger.ts:25 (contributionLedger)`; `web/lib/rosterScheduleOptimizer/contributionLedger.ts:25 contributionLedger`
- **Tags (heuristic):** denominators: per team game; generation: current
- **Opus view (RSO-005):**
  - Method: Per date in range: classify each team game as active (unique legal slot assignment), bench (exclusion receipt), reserve, outside_roster, elapsed, cancelled, no_game, unknown; gp/agp/bench counted for upcoming games; totals null unless complete; projectedPoints = playerAssignedPoints.
  - Inputs/units: player-games; fantasy points; sources: —
  - Output scale: per-player counts; projectedPoints fantasy points; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves); BenchDays, CompactSchedule, RosterContribution, RosterPlayerRow
  - Consumers: BenchDays.tsx; CompactSchedule.tsx; RosterContribution.tsx; RosterPlayerRow.tsx; drop order
- **Codex view (roster-contribution-ledger, calculation, location; Codex family 'roster-planning'):** Per-player contribution ledger
  - Purpose: Read an existing plan timeline and assignments to classify each day active/bench/reserve/outside/elapsed/cancelled/unknown; tally known and complete games and assigned points.
  - Inputs/units: Snapshot, evaluation, intent and authoritative membership timeline.
  - Output scale: Scheduled/active/bench game counts, known partial counts, projected points and day states.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): contributionLedger.ts:24 ('Readback of an existing plan, never a second optimizer or a drop recommendation')
  - Intended contract (Codex roster-contribution-ledger): Readback only, never another optimizer or drop recommendation. Source: web/lib/rosterScheduleOptimizer/contributionLedger.ts:25 contributionLedger.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/components/RosterScheduleOptimizer/BenchDays.test.tsx`; `web/lib/rosterScheduleOptimizer/contributionLedger.test.ts`; `{"discovered_not_run": ["web/components/RosterScheduleOptimizer/BenchDays.test.tsx", "web/lib/rosterScheduleOptimizer/refreshForecastInputs.test.ts", "web/lib/rosterScheduleOptimizer/contributionLedger.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-contribution-ledger) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-003 Roster schedule evaluation (bench games, DUST rate, slot utilization)

- **Match:** Both; Opus RSO-006; Codex roster-dust-rate, roster-schedule-gp, roster-slot-utilization
- **Purpose:** Sum daily matching results into roster, weekly, player and position congestion metrics.
- **Where:** `web/lib/rosterScheduleOptimizer/optimizer.ts:295 (evaluateRosterSchedule)`; `web/lib/rosterScheduleOptimizer/optimizer.ts:193 (aggregateDaily)`; `web/lib/rosterScheduleOptimizer/optimizer.ts:193 aggregateDaily`; `web/lib/rosterScheduleOptimizer/optimizer.ts:295 evaluateRosterSchedule`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: development, current
- **Opus view (RSO-006):**
  - Method: For every date any roster team plays, run exact matching. dustRate = totalBenchGames / totalScheduledGames; activeSlotUtilization = totalStartableGames / (activeSlotCount x number of league game dates). Weekly sums by Yahoo week; per-player and per-position (each eligible position counted) bench counts; highestConflictDates sorted by bench games. Weekly lineup mode flagged unsupported; roster over active+bench capacity flagged.
  - Inputs/units: player-games (counts), slot counts; sources: roster_optimizer_team_games
  - Output scale: counts; dustRate and activeSlotUtilization fractions 0-1; writes: —
  - Status: live — lib/draft-pro/dust.ts called by pages/api/v1/draft-pro/dust.ts and lib/draftDashboard/draftProDustPresentation.ts; docs/roster-schedule-optimizer.md:83 says the Draft Dashboard route sits behind a maintenance notice
  - Consumers: Draft Dashboard DUST (web/lib/draft-pro/dust.ts); calculateCandidateDust baseline
- **Codex view (roster-dust-rate, calculation, location; Codex family 'roster-schedule'):** Roster DUST rate
  - Purpose: Total bench games divided by total scheduled player-games; zero when denominator is zero.
  - Inputs/units: Bench and scheduled player-games (counts).
  - Output scale: Fraction, normally 0–1.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-schedule-gp, calculation, location; Codex family 'roster-schedule'):** Scheduled, active, benched and unresolved player-games
  - Purpose: Match each eligible date then sum assignment counts by roster, week, player and eligible position. Position counts may overlap for multi-position players.
  - Inputs/units: Prepared deduplicated team-date schedule, active/bench roster and slots.
  - Output scale: Nonnegative integer GP, startable GP, bench GP and unresolved GP; conflict-date ranking.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-slot-utilization, calculation, location; Codex family 'roster-schedule'):** Active slot utilization
  - Purpose: Total startable games / (active slot count × horizon date count); zero if either denominator factor is zero.
  - Inputs/units: Startable player-games; slot count; prepared schedule date count.
  - Output scale: Dimensionless utilization fraction.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): docs/roster-schedule-optimizer.md:27 (roster DUST rate = Bench Games / scheduled player-games)
  - Intended contract (Codex roster-dust-rate): DUST is schedule congestion, not player quality. Source: web/lib/rosterScheduleOptimizer/optimizer.ts:193 aggregateDaily.
  - Intended contract (Codex roster-schedule-gp): Static daily-lineup schedule capacity; weekly mode is reported unsupported here. Source: web/lib/rosterScheduleOptimizer/optimizer.ts:295 evaluateRosterSchedule.
  - Intended contract (Codex roster-slot-utilization): Horizon date count is schedule.gamesByDate.size, not all calendar days. Source: web/lib/rosterScheduleOptimizer/optimizer.ts:193 aggregateDaily.
  - External references: Games-played / max-games-started maximisation (streaming 'games per week' metric)
  - Fixtures/test data: `web/e2e/draft-pro-fixtures.ts`; `web/e2e/roster-schedule-optimizer-fixtures.ts`
  - Tests: `web/lib/draft-pro/dust.test.ts`; `web/lib/rosterScheduleOptimizer/optimizer.test.ts`; `{"discovered_not_run": ["web/lib/draft-pro/dust.test.ts", "web/lib/rosterScheduleOptimizer/optimizer.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/lib/rosterScheduleOptimizer/optimizer.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) utilization denominator uses every date with any league game, not dates the roster could use
  - (opus) position congestion counts a multi-eligible player's bench game under every eligible position (double counting by design)
  - (codex:roster-dust-rate) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-schedule-gp) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-slot-utilization) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-004 Plan evaluation totals (scheduled, active, bench games, projected value)

- **Match:** Both; Opus RSO-007; Codex roster-plan-category-values, roster-plan-goalie-minimum, roster-plan-points
- **Purpose:** Aggregate a whole plan over the date range into games and projected fantasy totals.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:660 (evaluatePreparedPlan)`; `web/lib/rosterScheduleOptimizer/planning.ts:942 (projectedValue)`; `web/lib/rosterScheduleOptimizer/planning.ts:1035 (benchGames)`; `web/lib/rosterScheduleOptimizer/planning.ts:60 categoryValue`; `web/lib/rosterScheduleOptimizer/planning.ts:68 categoryRelation`; `web/lib/rosterScheduleOptimizer/planning.ts:934 [inline calculation: Pooled category values and matchup outcomes]`; `web/lib/rosterScheduleOptimizer/planning.ts:948 [inline calculation: Expected goalie starts and minimum-coverage risk]`; `web/lib/rosterScheduleOptimizer/planning.ts:647 evaluatePlan`; `web/lib/rosterScheduleOptimizer/planning.ts:892 [inline calculation: Complete-plan projected fantasy points and assignment value]`; `web/lib/rosterScheduleOptimizer/planning.ts:939 [inline calculation: Complete-plan projected fantasy points and assignment value]`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (RSO-007):**
  - Method: Plays: roster members at puck drop (member.since < game time; no IR/IR+/NA; provider-listed out excluded). scheduledGames = plays; activeGames = planned rows excluding started/held locks; benchGames = max(0, scheduled - active). projectedStats = realized + sum of chosen forecast stats; projectedValue (points) = sum weight x projectedStats if all finite and no unresolved/conflict/stale schedule; else null. assignmentValue = sum playValue.
  - Inputs/units: player-games; stat counts; realized matchup stats (banked); sources: roster_optimizer_team_games, FORGE forecasts, Yahoo realized stats
  - Output scale: counts; projectedValue in fantasy points (realized + remaining); writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: planRoster; candidatePlanMetrics; healthyReserves; streamingChain certify; UI cards
- **Codex view (roster-plan-category-values, calculation, location; Codex family 'roster-planning'):** Pooled category values and matchup outcomes
  - Purpose: Counting numerator×multiplier or pooled numerator/denominator×multiplier; compare with opponent realized+remaining using higher/lower direction. Componentwise partial order marks better/worse/equal/tradeoff.
  - Inputs/units: Category definitions, own pooled stats, opponent pooled stats, directions and multipliers.
  - Output scale: Native-unit categories and win/loss/tie/unknown; no cross-category scalar.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-plan-goalie-minimum, calculation, location; Codex family 'roster-planning'):** Expected goalie starts and minimum-coverage risk
  - Purpose: For assigned goalies sum start probabilities by team-game capped at 1, then sum team-games; combine credited starts with future expectations. Count confirmed starts separately.
  - Inputs/units: Probabilities 0–1, verified minimum window, required/credited starts or appearances, penalty rule.
  - Output scale: Expected starts (fractional count), confirmed count, projected total, risk/minimumSatisfied flags.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-plan-points, calculation, location; Codex family 'roster-planning'):** Complete-plan projected fantasy points and assignment value
  - Purpose: Sum approved future chosen-game stats into realized totals, then weight. assignmentValue sums lineup-selection values; projectedValue includes banked realized stats.
  - Inputs/units: Roster, slots, locks, transaction timeline, realized stats, future forecasts and scoring weights.
  - Output scale: Fantasy-point scalar, projected stat vector, legality/coverage flags; null when relevant coverage unknown.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): tasks/prd-roster-schedule-optimizer.md; tasks/tasks-prd-rso-consolidated-2026-10-09.md; planning.ts:682-685 comment (started/held rows shown but never planned, valued or counted)
  - Intended contract (Codex roster-plan-category-values): Category outcomes are provisional means, not calibrated joint probabilities. Incomparable tradeoffs require manager choice. Source: web/lib/rosterScheduleOptimizer/planning.ts:60 categoryValue.
  - Intended contract (Codex roster-plan-goalie-minimum): Start probabilities do not establish appearance minimums; unknown required inputs/window withhold projected totals. Source: web/lib/rosterScheduleOptimizer/planning.ts:948.
  - Intended contract (Codex roster-plan-points): Comparison, assignment and totals permissions are distinct. A capacity-selected lineup may have known totals without being a quality recommendation. Source: web/lib/rosterScheduleOptimizer/planning.ts:647 evaluatePlan.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`; `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.e2e.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts`; `web/lib/rosterScheduleOptimizer/dailyDecisionReplay.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 17, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 31, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) projectedValue includes banked realized points, so it is matchup-to-date total, not remaining-only; nets cancel it
  - (opus) injured-out (IR/IR-LT/IR-NR/O) players are excluded from plays entirely - DTD players count fully
  - (codex:roster-plan-category-values) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-plan-goalie-minimum) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-plan-points) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-005 Candidate plan ordering and alternative display rule

- **Match:** Both; Opus RSO-008; Codex roster-candidate-plan-net
- **Purpose:** Order candidate plans by points or schedule, break exact ties by drop ownership, and decide when a different-drop alternative is shown.
- **Where:** `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.ts:45 (compareCandidatePlans)`; `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.ts:58 (orderCandidatePlans)`; `web/components/RosterScheduleOptimizer/CandidateBrowser.tsx:55 (alternativeShown)`; `web/components/RosterScheduleOptimizer/CandidateBrowser.tsx:47 (compareCandidateFits)`; `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.ts:89 candidatePlanMetrics`; `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.ts:45 compareCandidatePlans`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-008):**
  - Method: Primary netPoints (or netAGP), secondary the other, then no-drop first, fewer steps, ids. Exact-equivalent group reordered by lower dropped ownership when all known. Alternative shown if more netAGP, or netPoints >= rep - max(1, 10% \|rep\|).
  - Inputs/units: fantasy points; active games; ownership percent 0-100; sources: yahoo_player_ownership_daily
  - Output scale: ordering; boolean shown; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: CandidateBrowser UI
- **Codex view (roster-candidate-plan-net, calculation, location; Codex family 'roster-planning'):** Executable candidate plan net AGP, points, goalie starts and displacement
  - Purpose: Enumerate bounded legal acquisition/drop variants and subtract no-move evaluator totals; displacement is per-held-player baseline contribution minus retained contribution. Rank points then AGP or converse.
  - Inputs/units: Snapshot, intent, candidate/drop variants and evaluation quotas.
  - Output scale: Signed net games, fantasy points, expected starts; lost games/points; sorted representatives/alternatives.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): CandidateBrowser.tsx:51-54 (VORP S4 display rule); candidatePlanMetrics.ts:56-57 (R7 ownership tie)
  - Intended contract (Codex roster-candidate-plan-net): Unknown comparison inputs stay null; ownership may only break exact outcome ties. Source: web/lib/rosterScheduleOptimizer/candidatePlanMetrics.ts:89 candidatePlanMetrics.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx`; `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts`; `{"discovered_not_run": ["web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx", "web/components/RosterScheduleOptimizer/CandidateBrowser.integration.test.tsx", "web/lib/rosterScheduleOptimizer/refreshForecastInputs.test.ts", "web/lib/rosterScheduleOptimizer/providerRules.test.ts", "web/lib/rosterScheduleOptimizer/lineupGaps.test.ts", "web/lib/rosterScheduleOptimizer/executionAdapter.test.ts", "web/lib/rosterScheduleOptimizer/planning.test.ts", "web/lib/rosterScheduleOptimizer/dailyAcceptance.e2e.test.ts", "web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts", "web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts", "web/lib/rosterScheduleOptimizer/dailyDecisionReplay.test.ts", "web/lib/rosterScheduleData/forgeReservePayload.test.ts", "web/lib/integrations/yahoo/rosterPlanning.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) magic number: 1 point / 10% near-tie display rule
  - (codex:roster-candidate-plan-net) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-006 Candidate plan metrics (Best Fit swaps)

- **Match:** Both; Opus RSO-009; Codex roster-candidate-plan-net
- **Purpose:** Per available candidate, evaluate bounded one-acquisition plans and report net active games, net points, net goalie starts.
- **Where:** `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.ts:89 (candidatePlanMetrics)`; `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.ts:89 candidatePlanMetrics`; `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.ts:45 compareCandidatePlans`
- **Tags (heuristic):** denominators: per team game; generation: current
- **Opus view (RSO-009):**
  - Method: Baseline = outcome (points, quality-selected) else agp. Candidates eligible sorted by horizon points desc then team game count; goalie boost reserves ceil(max/4) slots for goalies when minimum at risk (credited + expectedStarts < required). Round-robin proposals; netAGP = active - baseline.active; netPoints = projectedValue diff (only if comparable); netGoalieStarts = expectedStarts diff; dominated plans (netAGP and netPoints both <=) pruned; lost AGP/points of dropped players from contribution ledgers; up to 3 drop variants per sort.
  - Inputs/units: activeGames counts; fantasy points; expected starts; sources: FORGE forecasts, schedule
  - Output scale: netAGP integer; netPoints fantasy points; netGoalieStarts real; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves); CandidateBrowser.tsx, CandidateCard.tsx
  - Consumers: CandidateBrowser.tsx; CandidateCard.tsx; lineupGaps.ts
- **Codex view (roster-candidate-plan-net, calculation, location; Codex family 'roster-planning'):** Executable candidate plan net AGP, points, goalie starts and displacement
  - Purpose: Enumerate bounded legal acquisition/drop variants and subtract no-move evaluator totals; displacement is per-held-player baseline contribution minus retained contribution. Rank points then AGP or converse.
  - Inputs/units: Snapshot, intent, candidate/drop variants and evaluation quotas.
  - Output scale: Signed net games, fantasy points, expected starts; lost games/points; sorted representatives/alternatives.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): candidatePlanMetrics.ts:88 ('One acquisition with its necessary reserve/drop, not an unbounded sequence search'), :102-103 goalie boost, :129-130 shortlist heuristic
  - Intended contract (Codex roster-candidate-plan-net): Unknown comparison inputs stay null; ownership may only break exact outcome ties. Source: web/lib/rosterScheduleOptimizer/candidatePlanMetrics.ts:89 candidatePlanMetrics.
  - External references: Waiver-wire value = marginal points/games over replacement (VORP-like)
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`; `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
  - Tests: `web/components/RosterScheduleOptimizer/CandidateBrowser.integration.test.tsx`; `web/components/RosterScheduleOptimizer/CandidateCard.test.tsx`; `web/lib/rosterScheduleData/forgeReservePayload.test.ts`; `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts`; `web/lib/rosterScheduleOptimizer/executionAdapter.test.ts`; `web/lib/rosterScheduleOptimizer/lineupGaps.test.ts`; `{"discovered_not_run": ["web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx", "web/components/RosterScheduleOptimizer/CandidateBrowser.integration.test.tsx", "web/lib/rosterScheduleOptimizer/refreshForecastInputs.test.ts", "web/lib/rosterScheduleOptimizer/providerRules.test.ts", "web/lib/rosterScheduleOptimizer/lineupGaps.test.ts", "web/lib/rosterScheduleOptimizer/executionAdapter.test.ts", "web/lib/rosterScheduleOptimizer/planning.test.ts", "web/lib/rosterScheduleOptimizer/dailyAcceptance.e2e.test.ts", "web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts", "web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts", "web/lib/rosterScheduleOptimizer/dailyDecisionReplay.test.ts", "web/lib/rosterScheduleData/forgeReservePayload.test.ts", "web/lib/integrations/yahoo/rosterPlanning.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) returns 'points' and 'activePoints' as the same array (duplicate field)
  - (opus) magic numbers: 40/160/240/12/24 caps, quarter goalie reservation
  - (codex:roster-candidate-plan-net) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-007 Streaming best-player-available ranking (blended FPts score)

- **Match:** Both; Opus RSO-011; Codex roster-streaming-blend
- **Purpose:** Rank available players within a streaming window.
- **Where:** `web/lib/rosterScheduleOptimizer/streamingChain.ts:187 (blended)`; `web/lib/rosterScheduleOptimizer/streamingChain.ts:73 (rankOptions)`; `web/lib/rosterScheduleOptimizer/streamingChain.ts:55 (NEAR_TIE)`; `web/lib/rosterScheduleOptimizer/streamingChain.ts:96 buildStreamingChains`; `web/lib/rosterScheduleOptimizer/streamingChain.ts:183 [inline calculation: Streamer projected/recent blend and certified chain net score]`; `web/lib/rosterScheduleOptimizer/streamingChain.ts:326 [inline calculation: Streamer projected/recent blend and certified chain net score]`
- **Tags (heuristic):** conditionality: unconditional; denominators: per game; generation: current
- **Opus view (RSO-011):**
  - Method: Per player-game score = (projected + last10FPtsPerGame)/2 when both known, else projected (null if projection unknown). Window score = sum over play days. Order: (most-starts objective) more games first; then score diff > 0.1 (NEAR_TIE); known score before unknown; more games; free agents before waiver; higher last-10 FPts/G; score; id. Goalie goal: rank by min(goal, expected starts) first.
  - Inputs/units: projected fantasy points per game (unconditional) + last-10 fantasy points per game played; sources: FORGE bridge forecasts, wgo_skater_stats, wgo_goalie_stats
  - Output scale: blended fantasy points per window; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: streaming chain DP; StreamingItinerary options
- **Codex view (roster-streaming-blend, calculation, location; Codex family 'roster-planning'):** Streamer projected/recent blend and certified chain net score
  - Purpose: Per game use (forecast FP + recent last-10 FP/G)/2 when both available, else forecast; sum chain assignments and subtract no-move blend. Certified plan evaluator supplies separate netPoints/netGames.
  - Inputs/units: Forecast FP/game, historical FP/G, team schedules, slot capacity, acquisitions and drop contribution.
  - Output scale: Heuristic blended points, certified signed net FP and net AGP; adds used.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): streamingChain.ts:12-13 (TJ 10-27: past + future average); CONFLICTS with recentForm.ts:49-50 ('A hint only: never a projection input')
  - Intended contract (Codex roster-streaming-blend): Blended score is for chain search/ranking; emitted legality and objective totals come from complete evaluator, not proposals. Source: web/lib/rosterScheduleOptimizer/streamingChain.ts:96 buildStreamingChains.
  - External references: Rest-of-season projection vs recent form weighting (regression to mean; recency usually small weight)
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/recentForm.test.ts`; `web/lib/rosterScheduleOptimizer/streamingChain.test.ts`; `{"discovered_not_run": ["web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/rosterScheduleOptimizer/streamingChain.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) 50/50 blend of projection with raw unshrunk last-10 FPts/G gives heavy recency weight (10-game samples are mostly noise)
  - (opus) unit mismatch: projected FPts are unconditional (goalie expected = per-start x start probability, skater includes participation) while last-10 FPts/G is per game actually played (conditional) - a backup goalie's form inflates his blended score
  - (opus) magic number: NEAR_TIE 0.1 absolute points regardless of window length
  - (opus) intent mismatch: recentForm.ts:49-50 says recent FPts/G is 'A hint only: never a projection input', yet streamingChain.ts:187 uses it as half of the ranking score
  - (codex:roster-streaming-blend) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-008 Category plan dominance relation

- **Match:** Both; Opus RSO-013; Codex roster-plan-category-values, roster-roster-plan-search
- **Purpose:** Partial-order comparison of two plans' category outcomes and acquisition cost.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:68 (categoryRelation)`; `web/lib/rosterScheduleOptimizer/planning.ts:1076 (compareCategoryEvaluations)`; `web/lib/rosterScheduleOptimizer/planning.ts:60 categoryValue`; `web/lib/rosterScheduleOptimizer/planning.ts:68 categoryRelation`; `web/lib/rosterScheduleOptimizer/planning.ts:934 [inline calculation: Pooled category values and matchup outcomes]`; `web/lib/rosterScheduleOptimizer/planning.ts:1331 planRoster`; `web/lib/rosterScheduleOptimizer/planning.ts:1120 compareEvaluations`; `web/lib/rosterScheduleOptimizer/planning.ts:1076 compareCategoryEvaluations`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-013):**
  - Method: Per category better/worse by direction; both -> tradeoff. Goalie coverage min(target, projected) overrides; agp objective prefers more activeGames; cost compared per period and by add count: better result with higher cost -> tradeoff; equal result with lower cost -> better (zero tolerance, no category weighting, no 5% rule).
  - Inputs/units: category values in native units; acquisition counts; sources: —
  - Output scale: relation enum better/worse/equal/tradeoff/unknown; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: safeAlternative; planRoster frontier filtering; candidatePlanMetrics
- **Codex view (roster-plan-category-values, calculation, location; Codex family 'roster-planning'):** Pooled category values and matchup outcomes
  - Purpose: Counting numerator×multiplier or pooled numerator/denominator×multiplier; compare with opponent realized+remaining using higher/lower direction. Componentwise partial order marks better/worse/equal/tradeoff.
  - Inputs/units: Category definitions, own pooled stats, opponent pooled stats, directions and multipliers.
  - Output scale: Native-unit categories and win/loss/tie/unknown; no cross-category scalar.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-roster-plan-search, calculation, location; Codex family 'roster-planning'):** Bounded roster-plan objective search
  - Purpose: Evaluate no-move and bounded transaction candidates/beam alternatives; compare permitted points or active-games objectives with goalie-coverage priority and category partial-order constraints.
  - Inputs/units: Plan intent, legal step candidates, all evaluator inputs, beam/work budgets.
  - Output scale: Ranked plan alternatives with exact evaluated totals, truncation diagnostics.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): planning.ts:66 ('A native-unit partial order, never a cross-category utility or global rank') and :1110-1112 (no significance floor, weighting or five-percent rule)
  - Intended contract (Codex roster-plan-category-values): Category outcomes are provisional means, not calibrated joint probabilities. Incomparable tradeoffs require manager choice. Source: web/lib/rosterScheduleOptimizer/planning.ts:60 categoryValue.
  - Intended contract (Codex roster-roster-plan-search): Heuristic bounded search is not a global optimality proof; facts and recommendations have separate eligibility. Source: web/lib/rosterScheduleOptimizer/planning.ts:1331 planRoster.
  - External references: Pareto dominance; contrast SGP/z-score weighted category value
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 17, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 24, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) no category weighting means most real swaps are 'tradeoff' and unranked
  - (codex:roster-plan-category-values) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-roster-plan-search) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-009 Opponent positional tilt (F vs D share allowed)

- **Match:** Both; Opus RSO-015; Codex roster-bridge-opponent-tilt
- **Purpose:** Scale skater points/shots by an opponent's tendency to allow production to forwards vs defence.
- **Where:** `web/lib/rosterScheduleData/forgeDailyBridge.ts:123 (opponentTilts)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:78 (TILT constants)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:123 opponentTilts`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (RSO-015):**
  - Method: Weights: this season 1, last season 20/games per row. D share = d_rate/(f_rate+d_rate); league share = mean team share. factor = clamp(1 + (own/league - 1) x games/(games+30), 0.85, 1.15); F uses 1-share mirror.
  - Inputs/units: points and shots allowed per game by position group; games; sources: opponent_skater_allowed_by_position
  - Output scale: multiplicative factor 0.85-1.15; writes: —
  - Status: live — (interim fallback) loadPlanningData(..., forgeDailyBridge: true) from pages/api/v1/roster-schedule-optimizer/data.ts:23, yahoo-current-data.ts:27, lib/integrations/yahoo/rosterPlanning.ts:417; runs only when no native/shared forecasts are admitted and env RSO_FORGE_DAILY_BRIDGE != 'off' (web/lib/rosterScheduleData/planning.ts:213); optional view opponent_skater_allowed_by_position (read failure skips tilt)
  - Consumers: retargetSkater via tiltBetween
- **Codex view (roster-bridge-opponent-tilt, calculation, location; Codex family 'roster-forecast-bridge'):** Opponent F/D points and shots tilt
  - Purpose: Prior season contributes 20 game-equivalents; derive D share of F+D per-game values, compare to league mean share; factor=1+(own/base−1)×games/(games+30), clamp 0.85–1.15; use complementary F share.
  - Inputs/units: Opponent F/D allowed totals/games, current/previous season.
  - Output scale: Dimensionless points/shots multiplier, 0.85–1.15.
  - Version/status: forge-daily-bridge-v1 Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): forgeDailyBridge.ts:120-122, 76-77
  - Intended contract (Codex roster-bridge-opponent-tilt): Positional mix only; overall opponent strength handled separately. Source: web/lib/rosterScheduleData/forgeDailyBridge.ts:123 opponentTilts.
  - External references: Shrinkage toward league mean (k=30 games)
  - Fixtures/test data: `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
  - Tests: `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts", "web/lib/rosterScheduleData/forgeDailyBridge.test.ts", "web/lib/projections/reserveProjections.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) magic numbers: 20-game last-season weight, 30-game shrink, +/-15% clamp
  - (opus) league share is an unweighted mean of team shares; player group F/D decided by any D eligibility
  - (codex:roster-bridge-opponent-tilt) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-010 Legacy naive team win probability (Poisson)

- **Match:** Both; Opus RSO-016; Codex roster-bridge-win-naive
- **Purpose:** Served-ledger baseline win chance from team xG; no longer used by bridge forecasts.
- **Where:** `web/lib/rosterScheduleData/forgeDailyBridge.ts:188 (teamWinProbability)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:188 teamWinProbability`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: legacy, current
- **Opus view (RSO-016):**
  - Method: Rates: scored = (own xGF + opp xGA)/2 x venue, allowed = (opp xGF + own xGA)/2 / venue, venue 1.04 home / 0.96 away; independent Poisson truncated at 12 goals; P = P(win) + P(tie)/2, clamped [0.05, 0.95]; 0.5 if unknown.
  - Inputs/units: xG per game; sources: nhl_team_data, nst_team_stats
  - Output scale: probability 0.05-0.95; writes: —
  - Status: legacy/dead — no non-test importer of forgeDailyBridge.teamWinProbability (rg); docstring :185-187 says retire once the ledger reads teamWins
  - Consumers: served-forecast ledger (per comment); not bridge forecasts
- **Codex view (roster-bridge-win-naive, calculation, location; Codex family 'roster-forecast-bridge'):** Legacy Poisson team win baseline
  - Purpose: Blend own xGF and opponent xGA; home venue factor 1.04 else0.96; enumerate independent Poisson goals 0..12 and sum win+half tie, clamp .05.. .95; unknown strength=.5.
  - Inputs/units: xGF/xGA per game and home flag.
  - Output scale: Win probability 0.05–0.95.
  - Version/status: Legacy baseline helper retained in checked-in bridge. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): forgeDailyBridge.ts:185-187
  - Intended contract (Codex roster-bridge-win-naive): Comment explicitly says bridge forecasts no longer use it; served-forecast ledger naive baseline pending retirement. Source: web/lib/rosterScheduleData/forgeDailyBridge.ts:188 teamWinProbability.
  - External references: Independent Poisson goal model (Skellam)
  - Fixtures/test data: none listed
  - Tests: `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `{"discovered_not_run": ["web/scripts/forge-goalie-backtest.test.ts", "web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts", "web/lib/rosterScheduleData/forgeDailyBridge.test.ts", "web/lib/projections/reserveProjections.test.ts", "web/lib/projections/goalie/goalieOutcomes.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) magic numbers: home 4%, clamp 0.05-0.95, ties split 50/50
  - (opus) dead code candidate: comment says retire once ledger reads teamWins
  - (opus) legacy/dead: no non-test caller
  - (codex:roster-bridge-win-naive) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-011 Season per-game rates for stats FORGE does not project

- **Match:** Both; Opus RSO-017; Codex roster-bridge-season-rates
- **Purpose:** Fill PIM, +/-, SH G/A/P, GWG and faceoffs with shrunk season rates.
- **Where:** `web/lib/rosterScheduleData/forgeDailyBridge.ts:219 (seasonRates)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:42 (LAST_SEASON_WEIGHT, SHRINK_GAMES, GWG prior)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:264 (skaterStats)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:219 seasonRates`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (RSO-017):**
  - Method: Weighted games/totals (this season 1, last 0.5). rate = (total + k x leagueRate)/(games + k), k: PIM 10, +/- 40 (league rate forced 0), SH G/A/P 20, FOW/FOL 0. GWG = projected goals x gwgShare, gwgShare = (gwg + 0.16 x 10)/(goals + 10). FORGE proj_pim/proj_plus_minus override when present.
  - Inputs/units: season totals (PIM minutes, +/-, SH points, GWG, faceoffs) and games played; sources: wgo_skater_stats_totals
  - Output scale: per-game rates; gwgShare fraction 0-1; writes: —
  - Status: live — (interim fallback) loadPlanningData(..., forgeDailyBridge: true) from pages/api/v1/roster-schedule-optimizer/data.ts:23, yahoo-current-data.ts:27, lib/integrations/yahoo/rosterPlanning.ts:417; runs only when no native/shared forecasts are admitted and env RSO_FORGE_DAILY_BRIDGE != 'off' (web/lib/rosterScheduleData/planning.ts:213)
  - Consumers: skaterStats -> bridge forecasts
- **Codex view (roster-bridge-season-rates, calculation, location; Codex family 'roster-forecast-bridge'):** Shrunk supplemental season per-game rates
  - Purpose: Current totals weight 1, previous season 0.5; rate=(weighted total+priorGames×league rate)/(weighted games+priorGames). PIM prior 10, +/-40 toward 0, SH G/A/P20, faceoffs0. GWG share=(GWG+0.16×10)/(goals+10).
  - Inputs/units: Player season totals and games; league weighted totals/games.
  - Output scale: PIM, +/−, SH goals/assists/points, faceoffs per game; GWG/goals fraction.
  - Version/status: forge-daily-bridge-v1 Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): forgeDailyBridge.ts:37, 41, 215-218
  - Intended contract (Codex roster-bridge-season-rates): Only recorded observations contribute; missing stats stay null. Source: web/lib/rosterScheduleData/forgeDailyBridge.ts:219 seasonRates.
  - External references: Regression to the mean (Tango k-games shrinkage)
  - Fixtures/test data: `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
  - Tests: `{"discovered_not_run": ["web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts", "web/lib/rosterScheduleData/forgeDailyBridge.test.ts", "web/lib/projections/reserveProjections.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) magic numbers: 0.5 last-season weight; k = 10/40/20/0; GWG prior 0.16 with 10 goals
  - (opus) these rates are not opponent/rest adjusted except GWG via goals; faceoffs unshrunk (k=0)
  - (opus) no direct test reference for seasonRates (rg over *.test.*)
  - (codex:roster-bridge-season-rates) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-012 Power-play zero policy and skater line construction

- **Match:** Both; Opus RSO-018; Codex roster-bridge-expectations
- **Purpose:** Convert FORGE head columns into league stat keys, treating blank PP heads as 0 when PP TOI <= 6 s.
- **Where:** `web/lib/rosterScheduleData/forgeDailyBridge.ts:257 (withPowerPlayZeros)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:264 (skaterStats)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:294 (forgeNativeLine)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:294 forgeNativeLine`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:303 buildForgeDailyBridgeForecasts`; `web/lib/rosterScheduleData/bridgeForecastWire.ts:42 reserveAppearanceProbability`
- **Tags (heuristic):** conditionality: conditional; denominators: per 60, per game; generation: current
- **Opus view (RSO-018):**
  - Method: Blank PP heads -> 0 only if ES heads finite and proj_toi_pp_seconds <= 6; else unknown. Totals from buildSkaterModeledHeadTotals; TOI minutes = (ES+PP+PK seconds)/60; PP_POINTS from heads.
  - Inputs/units: FORGE head counts; TOI seconds (ES/PP/PK); sources: forge_player_projections, forge_reserve_projections
  - Output scale: StatLine counts; TIME_ON_ICE_PER_GAME minutes; writes: —
  - Status: live — (interim fallback) loadPlanningData(..., forgeDailyBridge: true) from pages/api/v1/roster-schedule-optimizer/data.ts:23, yahoo-current-data.ts:27, lib/integrations/yahoo/rosterPlanning.ts:417; runs only when no native/shared forecasts are admitted and env RSO_FORGE_DAILY_BRIDGE != 'off' (web/lib/rosterScheduleData/planning.ts:213)
  - Consumers: bridge forecasts; later-impact basis rows
- **Codex view (roster-bridge-expectations, calculation, location; Codex family 'roster-forecast-bridge'):** Bridge expected stats and modeled-zero reserve policy
  - Purpose: Map native heads and sum modeled strengths; convert TOI seconds to minutes; supplementary season rates fill supported missing modeled stats; expected goalie line=conditional line×start chance. Reserve participation unknown uses labeled conservative zero, confirmed lineup full line.
  - Inputs/units: FORGE modeled stat heads, source conditioning, optional reserve lines and evidence, season rates.
  - Output scale: Expected native-unit per-game vector plus retained conditional vector and reserve state.
  - Version/status: forge-daily-bridge-v1 Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): forgeDailyBridge.ts:252-256 (declared modeled-zero policy), 291-293
  - Intended contract (Codex roster-bridge-expectations): Blank PP heads become zero only with ≤6 sec modeled PP time. Conservative unknown reserve zero is an assumption, not zero chance. Source: web/lib/rosterScheduleData/forgeDailyBridge.ts:294 forgeNativeLine.
  - External references: none suggested
  - Fixtures/test data: `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
  - Tests: `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `web/lib/rosterScheduleData/laterImpactInputs.test.ts`; `{"discovered_not_run": ["web/e2e/roster-schedule-optimizer.spec.ts", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts", "web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts", "web/lib/in-season/workspaceRoutes.test.ts", "web/lib/rosterScheduleData/forgeDailyBridge.test.ts", "web/lib/rosterScheduleData/forgeReservePayload.test.ts", "web/lib/rosterScheduleData/laterImpactInputs.test.ts", "web/lib/projections/reserveProjections.test.ts", "web/lib/integrations/yahoo/rosterPlanning.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) magic number: 6 s PP TOI threshold
  - (codex:roster-bridge-expectations) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-013 FORGE bridge skater line reuse and opponent/rest/tilt retargeting

- **Match:** Both; Opus RSO-019; Codex roster-bridge-expectations, roster-bridge-retarget-goalie, roster-bridge-retarget-skater, roster-bridge-start-probability, roster-bridge-team-win
- **Purpose:** Turn each skater's latest FORGE one-game projection into per-game forecasts for every remaining game in the window.
- **Where:** `web/lib/rosterScheduleData/forgeDailyBridge.ts:303 (buildForgeDailyBridgeForecasts)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:171 (retargetSkater)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:158 (restScale)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:510 (scale)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:294 forgeNativeLine`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:303 buildForgeDailyBridgeForecasts`; `web/lib/rosterScheduleData/bridgeForecastWire.ts:42 reserveAppearanceProbability`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:165 goalieShotContext`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:200 retargetGoalieLine`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:158 restScale`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:171 retargetSkater`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:570 [inline calculation: Goalie start shares, back-to-back and news floors]` …
- **Tags (heuristic):** percent scale: fraction 0-1; conditionality: unconditional; denominators: per game; generation: current
- **Opus view (RSO-019):**
  - Method: Exact-game row used as issued; otherwise latest line re-aimed: team = (1+goalsFor_new)/(1+goalsFor_old) from computeTeamStrengthContextAdjustment; rest = ratio of FORGE rest/home multipliers (toi, shot, goal, assist); tilt = ratio of opponent F/D tilts. Goals x team x goal x toi x tilt.points; assists x team x assist x toi x tilt.points; shots x team x shot x toi x tilt.shots; TOI/hits/blocks x toi; POINTS/PP_POINTS/SH_POINTS re-summed; round 4 dp. Skaters missing from team's latest run get no line (stale). Conditioning 'unconditional', startProbability null; expires min(puck drop, issuedAt + 8 days). Runs: lookback 7, ahead 7 days, proof of excluded third-party inputs required.
  - Inputs/units: FORGE heads per game (goals/assists/shots counts; TOI seconds -> minutes); team xG fractional adjustments; rest days; sources: forge_runs, forge_player_projections, nhl_team_data, nst_team_stats, games, opponent_skater_allowed_by_position
  - Output scale: per-game expected stat line (counts, TOI minutes), rounded 4 dp; writes: —
  - Status: live — (interim fallback) loadPlanningData(..., forgeDailyBridge: true) from pages/api/v1/roster-schedule-optimizer/data.ts:23, yahoo-current-data.ts:27, lib/integrations/yahoo/rosterPlanning.ts:417; runs only when no native/shared forecasts are admitted and env RSO_FORGE_DAILY_BRIDGE != 'off' (web/lib/rosterScheduleData/planning.ts:213)
  - Consumers: loadPlanningData -> RSO planner, streaming, candidate metrics
- **Codex view (roster-bridge-expectations, calculation, codex_part_of_opus; Codex family 'roster-forecast-bridge'):** Bridge expected stats and modeled-zero reserve policy
  - Purpose: Map native heads and sum modeled strengths; convert TOI seconds to minutes; supplementary season rates fill supported missing modeled stats; expected goalie line=conditional line×start chance. Reserve participation unknown uses labeled conservative zero, confirmed lineup full line.
  - Inputs/units: FORGE modeled stat heads, source conditioning, optional reserve lines and evidence, season rates.
  - Output scale: Expected native-unit per-game vector plus retained conditional vector and reserve state.
  - Version/status: forge-daily-bridge-v1 Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-bridge-retarget-goalie, calculation, codex_part_of_opus; Codex family 'roster-forecast-bridge'):** Retargeted goalie conditional line
  - Purpose: Rest/home shot context clamped −0.15..0.20; scale saves/shots and goals-against by new/old (1+context) ratios; shutout divided by goals-against factor capped at 1.
  - Inputs/units: Conditional per-start line and old/new team/opponent, rest and venue adjustments.
  - Output scale: Per-start expected saves/shots/GA and shutout probability.
  - Version/status: forge-daily-bridge-v1 Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-bridge-retarget-skater, calculation, codex_part_of_opus; Codex family 'roster-forecast-bridge'):** Retargeted skater game line
  - Purpose: Compute new/old rest/home multiplier ratios; goals/assists/shots scale by team-context, relevant rest rate×TOI and positional tilt; hits/blocks/time by TOI ratio; recompute P/PPP/SHP from components.
  - Inputs/units: Source line counts/minutes, old/new rest/home context, opponent/team multipliers.
  - Output scale: Expected per-game stat line, rounded 4 decimals.
  - Version/status: forge-daily-bridge-v1 Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-bridge-start-probability, calculation, codex_part_of_opus; Codex family 'roster-forecast-bridge'):** Goalie start shares, back-to-back and news floors
  - Purpose: Redistribute team shares; exact projected starter evidence overrides; B2B usual starter retains .55 of chance, transferred when closed; likely news floor .8/projected .65; confirmed 1/ruled-out0; open mass not fabricated.
  - Inputs/units: Historical team shares, native date-specific goalie projection, rest sequence, admitted goalie news.
  - Output scale: Per-goalie start probabilities 0–1; may retain unallocated open-team mass.
  - Version/status: forge-daily-bridge-v1 Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-bridge-team-win, calculation, codex_part_of_opus; Codex family 'roster-forecast-bridge'):** Paired bridge team win probability
  - Purpose: Use both FORGE goalie win forecasts as own/(own+other); single side divides by STARTER_DECISION_SHARE and complements opponent; otherwise FORGE team win model using xG priors/rest.
  - Inputs/units: Admitted game projections, paired teams, starter-decision share, team priors.
  - Output scale: Paired team probabilities summing to 1, source forge/forge_paired/forge_model.
  - Version/status: forge-daily-bridge-v1 Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): forgeDailyBridge.ts:19-20 (interim RSO source until native forecasts, TJ 2026-10-19); limitation text :709
  - Intended contract (Codex roster-bridge-expectations): Blank PP heads become zero only with ≤6 sec modeled PP time. Conservative unknown reserve zero is an assumption, not zero chance. Source: web/lib/rosterScheduleData/forgeDailyBridge.ts:294 forgeNativeLine.
  - Intended contract (Codex roster-bridge-retarget-goalie): Team win probability calculated separately, not moved by this function. Source: web/lib/rosterScheduleData/forgeDailyBridge.ts:165 goalieShotContext.
  - Intended contract (Codex roster-bridge-retarget-skater): Uses FORGE rest/team calculators as dependencies; interim reuse of latest FORGE line. Source: web/lib/rosterScheduleData/forgeDailyBridge.ts:158 restScale.
  - Intended contract (Codex roster-bridge-start-probability): Not a calibrated claim/appearance probability; conditional stats and expectations stay distinct. Source: web/lib/rosterScheduleData/forgeDailyBridge.ts:303 buildForgeDailyBridgeForecasts.
  - Intended contract (Codex roster-bridge-team-win): Team win chance kept separate from goalie’s personal win expectation. Source: web/lib/rosterScheduleData/forgeDailyBridge.ts:303 buildForgeDailyBridgeForecasts.
  - External references: Opponent-adjusted per-game projections (log5/multiplicative opponent factors)
  - Fixtures/test data: `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`; `web/lib/player-forecasts/rsoUsePolicy.fixtures.ts`; `web/__tests__/fixtures/consumerGameRevision.ts`
  - Tests: `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `web/lib/rosterScheduleData/forgeReservePayload.test.ts`; `web/lib/rosterScheduleData/planning.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts", "web/lib/rosterScheduleData/forgeDailyBridge.test.ts", "web/lib/projections/reserveProjections.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts", "web/lib/rosterScheduleData/forgeDailyBridge.test.ts", "web/lib/rosterScheduleData/forgeReservePayload.test.ts", "web/lib/rosterScheduleData/laterImpactInputs.test.ts", "web/lib/projections/reserveProjections.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/e2e/roster-schedule-optimizer.spec.ts", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts", "web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts", "web/lib/in-season/workspaceRoutes.test.ts", "web/lib/rosterScheduleData/forgeDailyBridge.test.ts", "web/lib/rosterScheduleData/forgeReservePayload.test.ts", "web/lib/rosterScheduleData/laterImpactInputs.test.ts", "web/lib/projections/reserveProjections.test.ts", "web/lib/integrations/yahoo/rosterPlanning.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/scripts/forge-counterfactual-backtest.test.ts", "web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts", "web/lib/rosterScheduleData/forgeDailyBridge.test.ts", "web/lib/projections/reserveProjections.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) one game line is reused for all remaining games (stationary rates), only re-aimed by multiplicative factors
  - (opus) skater lines are labelled unconditional with no dress/scratch probability (participation implicitly 1 if in team's latest run)
  - (opus) hits/blocks/TOI not scaled by opponent strength; PP stats scaled by even-strength-derived team factor
  - (codex:roster-bridge-expectations) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-bridge-retarget-goalie) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-bridge-retarget-skater) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-bridge-start-probability) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-bridge-team-win) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-014 Reserve lines and 'no FORGE line' conservative zeros

- **Match:** Both; Opus RSO-020; Codex roster-bridge-expectations
- **Purpose:** Give every identified player a row: reserve skaters/goalies and players with no FORGE line count 0 unless news confirms.
- **Where:** `web/lib/rosterScheduleData/forgeDailyBridge.ts:425 (skaterState)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:445 (emitReserve)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:651 (noLineTemplate)`; `web/lib/rosterScheduleData/bridgeForecastWire.ts:42 (reserveAppearanceProbability)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:294 forgeNativeLine`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:303 buildForgeDailyBridgeForecasts`; `web/lib/rosterScheduleData/bridgeForecastWire.ts:42 reserveAppearanceProbability`
- **Tags (heuristic):** percent scale: fraction 0-1; conditionality: conditional; denominators: per game; generation: current
- **Opus view (RSO-020):**
  - Method: Reserve skater: stats = conditional line only if 'confirmed_lineup', else all-zero stats (appearance 1 confirmed / 0 confirmed out / null otherwise) with conditional line kept. No-line players: every scoring key 0 under team's latest proven run (skipped when a withheld newer run exists or heads unknown).
  - Inputs/units: FORGE reserve conditional lines; IFTTT news assertions; sources: forge_reserve_projections, daily board evidence
  - Output scale: all-zero expected stats (counted); appearance probability 1/0/null; writes: —
  - Status: live — (interim fallback) loadPlanningData(..., forgeDailyBridge: true) from pages/api/v1/roster-schedule-optimizer/data.ts:23, yahoo-current-data.ts:27, lib/integrations/yahoo/rosterPlanning.ts:417; runs only when no native/shared forecasts are admitted and env RSO_FORGE_DAILY_BRIDGE != 'off' (web/lib/rosterScheduleData/planning.ts:213); reserve pass flagged by env FORGE_RESERVE_PASS_ENABLED=true (lib/projections/reserveProjections.ts:23-24); no-line zeros live (TJ option B 2026-10-26)
  - Consumers: planner totals (counted as 0)
- **Codex view (roster-bridge-expectations, calculation, location; Codex family 'roster-forecast-bridge'):** Bridge expected stats and modeled-zero reserve policy
  - Purpose: Map native heads and sum modeled strengths; convert TOI seconds to minutes; supplementary season rates fill supported missing modeled stats; expected goalie line=conditional line×start chance. Reserve participation unknown uses labeled conservative zero, confirmed lineup full line.
  - Inputs/units: FORGE modeled stat heads, source conditioning, optional reserve lines and evidence, season rates.
  - Output scale: Expected native-unit per-game vector plus retained conditional vector and reserve state.
  - Version/status: forge-daily-bridge-v1 Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): forgeDailyBridge.ts:640-644 (TJ option B 2026-10-26 conservative 0); bridgeForecastWire.ts:40-41
  - Intended contract (Codex roster-bridge-expectations): Blank PP heads become zero only with ≤6 sec modeled PP time. Conservative unknown reserve zero is an assumption, not zero chance. Source: web/lib/rosterScheduleData/forgeDailyBridge.ts:294 forgeNativeLine.
  - External references: none suggested
  - Fixtures/test data: `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
  - Tests: `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `web/lib/rosterScheduleData/forgeReservePayload.test.ts`; `{"discovered_not_run": ["web/e2e/roster-schedule-optimizer.spec.ts", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts", "web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts", "web/lib/in-season/workspaceRoutes.test.ts", "web/lib/rosterScheduleData/forgeDailyBridge.test.ts", "web/lib/rosterScheduleData/forgeReservePayload.test.ts", "web/lib/rosterScheduleData/laterImpactInputs.test.ts", "web/lib/projections/reserveProjections.test.ts", "web/lib/integrations/yahoo/rosterPlanning.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) conservative zeros make projected totals 'known' and comparable, biasing toward dropping/benching uncovered players and making their drop contribution a known 0
  - (opus) no direct test reference for reserveAppearanceProbability (rg)
  - (codex:roster-bridge-expectations) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-015 Team strength priors blend

- **Match:** Both; Opus RSO-022; Codex roster-bridge-team-priors
- **Purpose:** Per-team xGA/xGF per game prior blending this season with last season.
- **Where:** `web/lib/rosterScheduleData/forgeDailyBridge.ts:91 (teamStrengthPriors)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:91 teamStrengthPriors`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (RSO-022):**
  - Method: Latest date row whose xga/xga_per_game ~= games_played (\|diff\|<0.5), unique. Blend last season as LAST_SEASON_PRIOR_GAMES=20 games: xgaPerGame = (xga + 20 x lastXga/gp) / (played + 20); xgfPerGame = (xgf_pg x played + 20 x lastXgf)/(played + 20).
  - Inputs/units: xGA/xGF totals and per game; games played; sources: nhl_team_data, nst_team_stats
  - Output scale: xG per game; writes: —
  - Status: live — (interim fallback) loadPlanningData(..., forgeDailyBridge: true) from pages/api/v1/roster-schedule-optimizer/data.ts:23, yahoo-current-data.ts:27, lib/integrations/yahoo/rosterPlanning.ts:417; runs only when no native/shared forecasts are admitted and env RSO_FORGE_DAILY_BRIDGE != 'off' (web/lib/rosterScheduleData/planning.ts:213)
  - Consumers: bridge context(), teamWin model
- **Codex view (roster-bridge-team-priors, calculation, location; Codex family 'roster-forecast-bridge'):** Blended team xGF/xGA priors
  - Purpose: Select latest uniquely reconciled team row; blend last-season xG per game with 20 prior games and current inferred games=xGA/xGAperGame.
  - Inputs/units: Current team xG totals/rates and last-season xG+GP.
  - Output scale: Expected goals for/against per game and xGA-equivalent totals.
  - Version/status: forge-daily-bridge-v1 Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): forgeDailyBridge.ts:88-90, 79-80 (last season = 20 games)
  - Intended contract (Codex roster-bridge-team-priors): Interim bridge input transformation; independent runtime source verification not performed. Source: web/lib/rosterScheduleData/forgeDailyBridge.ts:91 teamStrengthPriors.
  - External references: Bayesian prior/regression to previous season (Tango-style k games)
  - Fixtures/test data: `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
  - Tests: `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts", "web/lib/rosterScheduleData/forgeDailyBridge.test.ts", "web/lib/projections/reserveProjections.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) magic number: last season = 20 games
  - (opus) blended prior's 'xga' field = current xga + 20 x last per-game (mixed units vs xgaPerGame)
  - (opus) nst_team_stats 'all' situation vs nhl_team_data definition may differ (mixed xG sources)
  - (codex:roster-bridge-team-priors) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-016 Later-period impact (Delta F rate scenario)

- **Match:** Both; Opus RSO-024; Codex roster-later-impact
- **Purpose:** Informational value of a plan's end roster vs no-move roster over the next league period.
- **Where:** `web/lib/rosterScheduleOptimizer/futureImpact.ts:241 (evaluateLaterImpact)`; `web/lib/rosterScheduleOptimizer/futureImpact.ts:48 (resolveLaterPeriod)`; `web/lib/rosterScheduleOptimizer/futureImpact.ts:110 (sourceTiming)`; `web/lib/rosterScheduleOptimizer/futureImpact.ts:154 (selectSourceRow)`; `web/lib/rosterScheduleOptimizer/futureImpact.ts:297 (evaluateArm)`; `web/lib/rosterScheduleOptimizer/futureImpact.ts:236 (laterImpactForApp)`; `web/lib/rosterScheduleOptimizer/futureImpact.ts:241 evaluateLaterImpact`; `web/lib/rosterScheduleOptimizer/futureImpact.ts:48 resolveLaterPeriod`; `web/lib/rosterScheduleOptimizer/futureImpact.ts:297 evaluateArm`
- **Tags (heuristic):** conditionality: conditional; denominators: per game; generation: research, current
- **Opus view (RSO-024):**
  - Method: Period F = next actual league period after window, else assumed 7 days; must lie within decision date + calendarDays-1 and season. Source row = admitted h1 row with greatest capture completion <= decision; stale if issue/input age > 8 days (MAX_SOURCE_AGE_MS). Each arm: stationary per-game line applied to every F game (goalies forced 'conditional'; reserve rows zeroed), evaluated by evaluateScenarioPlan with realized 0, no opponent, goalie minimum restarted. Delta = plan - noMove (points, components, pooled category ratios). No discounting.
  - Inputs/units: FORGE per-game native stat lines; ISO instants; calendar days; sources: forge_player_projections, forge_goalie_projections, forge_reserve_projections, roster_optimizer_team_games, yahoo_matchup_weeks
  - Output scale: Delta fantasy points / native component deltas; state enum; writes: —
  - Status: flagged off — LATER_IMPACT_CONTRACT.accepted=false (futureImpact.ts:10) makes laterImpactForApp() always blocked; inputs behind env RSO_LATER_IMPACT_SCENARIO=on (laterImpactInputs.ts:29-32), default off
  - Consumers: laterImpactForApp (always blocked); laterImpactInputs.ts
- **Codex view (roster-later-impact, calculation, location; Codex family 'roster-planning'):** Later-period fixed-roster rate-scenario delta
  - Purpose: Resolve later period, hold boundary rosters fixed, apply eligible decision-time per-game lines to later schedule and evaluate each arm; delta=plan−no-move in points/components/pooled categories.
  - Inputs/units: Decision-time snapshot/source capture, fixed rosters, complete later schedule, period/calendar policy.
  - Output scale: Signed later points/stat/category deltas or nonnumeric reason state.
  - Version/status: LATER_IMPACT_CONTRACT rso-later-impact-rate-scenario v2 has accepted:false; normal app path blocked, offlineFixture bypass is explicit. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. N…
- **Audit context:**
  - Intent (Opus): futureImpact.ts:8-9; tasks/artifacts/rso-wave2-2026-10-25/VORP/S3-SCENARIO-CONTRACT.md; tasks/diaries/2026-10-29-claude-rso-vorp-assessment.md
  - Intended contract (Codex roster-later-impact): Informational only, never weekly ranking/pruning. Goalies remain conditional, no inferred future starts. Source: web/lib/rosterScheduleOptimizer/futureImpact.ts:241 evaluateLaterImpact.
  - External references: Rest-of-season VORP / discounted future value
  - Fixtures/test data: `tasks/artifacts/rso-wave2-2026-10-25/VORP/S3-SCENARIO-CONTRACT.md`
  - Tests: `web/lib/rosterScheduleData/laterImpactInputs.test.ts`; `web/lib/rosterScheduleOptimizer/futureImpact.test.ts`; `{"discovered_not_run": ["web/lib/rosterScheduleOptimizer/futureImpact.test.ts", "web/lib/rosterScheduleData/laterImpactInputs.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) dead code in app: LATER_IMPACT_CONTRACT.accepted=false so laterImpactForApp always returns 'scenario_contract_not_accepted'
  - (opus) no time discounting or roster churn; stationary last-line rates
  - (opus) basis lineup rows come from SKATER/GOALIE_COLUMNS which do not select a 'conditioning' column, so conditioningOf() returns null and every lineup player's arm would be 'unknown' (only reserve rows are tagged unconditional)
  - (opus) doubly gated: env RSO_LATER_IMPACT_SCENARIO and accepted=false
  - (codex:roster-later-impact) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-017 Bridge goalie per-start line, wins and expected stats

- **Match:** Both; Opus RSO-025; Codex roster-bridge-retarget-goalie, roster-bridge-retarget-skater, roster-bridge-team-win
- **Purpose:** Per-start goalie line re-aimed to the opponent, win credit, and expected (x start chance) stats.
- **Where:** `web/lib/rosterScheduleData/forgeDailyBridge.ts:284 (goalieLine)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:200 (retargetGoalieLine)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:165 (goalieShotContext)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:521 (teamWin)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:626 (wins/losses line)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:165 goalieShotContext`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:200 retargetGoalieLine`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:158 restScale`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:171 retargetSkater`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:303 buildForgeDailyBridgeForecasts`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:526 [inline calculation: Paired bridge team win probability]`
- **Tags (heuristic):** percent scale: fraction 0-1; conditionality: conditional; denominators: per game; generation: current
- **Opus view (RSO-025):**
  - Method: Per start: SAVES, GA, SA, SHUTOUTS=shutout prob, GOALIE_MINUTES 60, GAMES_STARTED 1. Retarget: shots factor = (1+SA_to)/(1+SA_from) x (1+venue_to)/(1+venue_from); GA factor similarly; shutout = min(1, p/GAfactor). Venue/rest context = clamp(oppRest(+0.03 rested / -0.04 B2B) + ownB2B 0.02 + (home -0.01 / away +0.02), -0.15, 0.2). Team win: own/(own+other) if both FORGE values, own/0.984, 1-other/0.984, else FORGE Poisson model on xG priors x rest goal multipliers. WINS = win x 0.984; LOSSES = 1 - WINS. Expected stats = round4(line x startProbability).
  - Inputs/units: per-start saves/GA/SA counts, shutout prob 0-1, team win prob 0-1, venue/rest fractional adjustments; sources: forge_goalie_projections, nhl_team_data, games
  - Output scale: expected per-game goalie stats (counts x start prob); wins/losses expected per game 0-1; writes: —
  - Status: live — (interim fallback) loadPlanningData(..., forgeDailyBridge: true) from pages/api/v1/roster-schedule-optimizer/data.ts:23, yahoo-current-data.ts:27, lib/integrations/yahoo/rosterPlanning.ts:417; runs only when no native/shared forecasts are admitted and env RSO_FORGE_DAILY_BRIDGE != 'off' (web/lib/rosterScheduleData/planning.ts:213)
  - Consumers: planner goalie scoring; applyProviderGoalieStarts
- **Codex view (roster-bridge-retarget-goalie, calculation, location; Codex family 'roster-forecast-bridge'):** Retargeted goalie conditional line
  - Purpose: Rest/home shot context clamped −0.15..0.20; scale saves/shots and goals-against by new/old (1+context) ratios; shutout divided by goals-against factor capped at 1.
  - Inputs/units: Conditional per-start line and old/new team/opponent, rest and venue adjustments.
  - Output scale: Per-start expected saves/shots/GA and shutout probability.
  - Version/status: forge-daily-bridge-v1 Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-bridge-retarget-skater, calculation, location; Codex family 'roster-forecast-bridge'):** Retargeted skater game line
  - Purpose: Compute new/old rest/home multiplier ratios; goals/assists/shots scale by team-context, relevant rest rate×TOI and positional tilt; hits/blocks/time by TOI ratio; recompute P/PPP/SHP from components.
  - Inputs/units: Source line counts/minutes, old/new rest/home context, opponent/team multipliers.
  - Output scale: Expected per-game stat line, rounded 4 decimals.
  - Version/status: forge-daily-bridge-v1 Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-bridge-team-win, calculation, location; Codex family 'roster-forecast-bridge'):** Paired bridge team win probability
  - Purpose: Use both FORGE goalie win forecasts as own/(own+other); single side divides by STARTER_DECISION_SHARE and complements opponent; otherwise FORGE team win model using xG priors/rest.
  - Inputs/units: Admitted game projections, paired teams, starter-decision share, team priors.
  - Output scale: Paired team probabilities summing to 1, source forge/forge_paired/forge_model.
  - Version/status: forge-daily-bridge-v1 Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): forgeDailyBridge.ts:197-199, 515-519, 623 comment; limitation :711
  - Intended contract (Codex roster-bridge-retarget-goalie): Team win probability calculated separately, not moved by this function. Source: web/lib/rosterScheduleData/forgeDailyBridge.ts:165 goalieShotContext.
  - Intended contract (Codex roster-bridge-retarget-skater): Uses FORGE rest/team calculators as dependencies; interim reuse of latest FORGE line. Source: web/lib/rosterScheduleData/forgeDailyBridge.ts:158 restScale.
  - Intended contract (Codex roster-bridge-team-win): Team win chance kept separate from goalie’s personal win expectation. Source: web/lib/rosterScheduleData/forgeDailyBridge.ts:303 buildForgeDailyBridgeForecasts.
  - External references: Goalie W = team win x decision share; Poisson/Skellam goal models
  - Fixtures/test data: `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
  - Tests: `web/lib/projections/goalie/goalieOutcomes.test.ts`; `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts", "web/lib/rosterScheduleData/forgeDailyBridge.test.ts", "web/lib/projections/reserveProjections.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts", "web/lib/rosterScheduleData/forgeDailyBridge.test.ts", "web/lib/rosterScheduleData/forgeReservePayload.test.ts", "web/lib/rosterScheduleData/laterImpactInputs.test.ts", "web/lib/projections/reserveProjections.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/scripts/forge-counterfactual-backtest.test.ts", "web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts", "web/lib/rosterScheduleData/forgeDailyBridge.test.ts", "web/lib/projections/reserveProjections.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) unit/definition: LOSSES_GOALIE = 1 - 0.984 x P(team win) counts no-decisions as losses (should be about (1-P(win)) x 0.984)
  - (opus) shutout retarget divides a probability by a goals-against ratio (not a Poisson P(0) recomputation)
  - (opus) a starter's per-start line is reused for backups with no line of their own ('team_line')
  - (codex:roster-bridge-retarget-goalie) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-bridge-retarget-skater) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-bridge-team-win) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-018 Bridge goalie start probabilities

- **Match:** Both; Opus RSO-026; Codex roster-bridge-start-probability
- **Purpose:** Per team-game start chances for each identified goalie.
- **Where:** `web/lib/rosterScheduleData/forgeDailyBridge.ts:565 (goalie loop)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:576 (rescale)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:590 (back-to-back)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:602 (news floors)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:40 (FORGE_DAILY_BRIDGE_GOALIE_NEWS_FLOORS)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:303 buildForgeDailyBridgeForecasts`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:570 [inline calculation: Goalie start shares, back-to-back and news floors]`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (RSO-026):**
  - Method: Share = exact game row else latest current-team current-season row (l10 share, else season share). FORGE starter_probability overrides for exact game; others rescaled to 1-p. Rescale: if any roster goalie unknown, only scale down (min(1, mass/total)), so sum may be < 1. Back-to-back second night (no exact row): starter keeps 55% of his chance, rest redistributed proportionally (unless open). News: confirmed -> 1 (others 0), ruled_out -> 0 (others rescaled to 1), likely floor 0.8, projected floor 0.65; disputed ignored. Unknown share -> forecast counts 0 starts (reserve 'start_unknown').
  - Inputs/units: start shares fraction 0-1 (l10_start_pct, season_start_pct); starter_probability 0-1; rest days; sources: goalie_start_projections, forge_goalie_projections, daily board evidence (IFTTT news), games
  - Output scale: start probability 0-1 per goalie-game (team sum <= 1); writes: —
  - Status: live — (interim fallback) loadPlanningData(..., forgeDailyBridge: true) from pages/api/v1/roster-schedule-optimizer/data.ts:23, yahoo-current-data.ts:27, lib/integrations/yahoo/rosterPlanning.ts:417; runs only when no native/shared forecasts are admitted and env RSO_FORGE_DAILY_BRIDGE != 'off' (web/lib/rosterScheduleData/planning.ts:213)
  - Consumers: bridge goalie forecasts; goalie minimum coverage; streaming goalie starts
- **Codex view (roster-bridge-start-probability, calculation, location; Codex family 'roster-forecast-bridge'):** Goalie start shares, back-to-back and news floors
  - Purpose: Redistribute team shares; exact projected starter evidence overrides; B2B usual starter retains .55 of chance, transferred when closed; likely news floor .8/projected .65; confirmed 1/ruled-out0; open mass not fabricated.
  - Inputs/units: Historical team shares, native date-specific goalie projection, rest sequence, admitted goalie news.
  - Output scale: Per-goalie start probabilities 0–1; may retain unallocated open-team mass.
  - Version/status: forge-daily-bridge-v1 Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): forgeDailyBridge.ts:39-40 (news floors, TJ may tune), 82-83 (B2B 0.55), 572-574 comment
  - Intended contract (Codex roster-bridge-start-probability): Not a calibrated claim/appearance probability; conditional stats and expectations stay distinct. Source: web/lib/rosterScheduleData/forgeDailyBridge.ts:303 buildForgeDailyBridgeForecasts.
  - External references: Goalie start models (rest-based, last-N share); B2B starter repeat rates (~25-35% historically)
  - Fixtures/test data: `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
  - Tests: `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts", "web/lib/rosterScheduleData/forgeDailyBridge.test.ts", "web/lib/rosterScheduleData/forgeReservePayload.test.ts", "web/lib/rosterScheduleData/laterImpactInputs.test.ts", "web/lib/projections/reserveProjections.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) magic numbers: B2B starter share 0.55, news floors 0.8/0.65
  - (opus) 0.55 retention on the second night of a back-to-back is high vs typical NHL starter back-to-back rates
  - (opus) unknown-share goalies counted as 0 starts while teammates are not scaled up, so team expected starts < 1
  - (codex:roster-bridge-start-probability) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-019 Goalie minimum coverage target and preferred window

- **Match:** Both; Opus RSO-027; Codex roster-plan-category-values
- **Purpose:** Decide when goalie-start coverage of a league minimum is a planning target and which dates count as early/late week.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:484 (goalieMinimumWindowVerified)`; `web/lib/rosterScheduleOptimizer/planning.ts:491 (pointsGoalieCoverageTarget)`; `web/lib/rosterScheduleOptimizer/planning.ts:497 (categoryGoalieCoverageTarget)`; `web/lib/rosterScheduleOptimizer/planning.ts:54 (preferredGoalieDate)`; `web/lib/rosterScheduleOptimizer/planning.ts:60 categoryValue`; `web/lib/rosterScheduleOptimizer/planning.ts:68 categoryRelation`; `web/lib/rosterScheduleOptimizer/planning.ts:934 [inline calculation: Pooled category values and matchup outcomes]`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-027):**
  - Method: Target = required when coverage='cover', counts='starts', credited<required and planning range covers the minimum period (start>=periodStart, end>=last day, end<periodEnd). Weekday Mon=1; early = weekday <= 3 (mon_wed) or <= 4 (mon_thu).
  - Inputs/units: starts (counts); ISO instants; weekday; sources: Yahoo league settings
  - Output scale: target start count or null; boolean preferred date; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: refineOutcomeLineup; compareEvaluations; explainBenchDecisions
- **Codex view (roster-plan-category-values, calculation, location; Codex family 'roster-planning'):** Pooled category values and matchup outcomes
  - Purpose: Counting numerator×multiplier or pooled numerator/denominator×multiplier; compare with opponent realized+remaining using higher/lower direction. Componentwise partial order marks better/worse/equal/tradeoff.
  - Inputs/units: Category definitions, own pooled stats, opponent pooled stats, directions and multipliers.
  - Output scale: Native-unit categories and win/loss/tie/unknown; no cross-category scalar.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED in code beyond names; intent.goalieSplit/goalieWindow schema web/lib/in-season/workspaceSchema.ts:148
  - Intended contract (Codex roster-plan-category-values): Category outcomes are provisional means, not calibrated joint probabilities. Incomparable tradeoffs require manager choice. Source: web/lib/rosterScheduleOptimizer/planning.ts:60 categoryValue.
  - External references: Yahoo goalie minimum starts rule
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 17, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) weekday computed in UTC noon of the date string, not league-local week start
  - (codex:roster-plan-category-values) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-020 Projected goalie starts and minimum risk

- **Match:** Both; Opus RSO-028; Codex roster-plan-goalie-minimum
- **Purpose:** Expected goalie starts from chosen goalie games and whether the league minimum is at risk.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:955 (goalie block in evaluatePreparedPlan)`; `web/lib/rosterScheduleOptimizer/planning.ts:537 (refine score goalieGroups)`; `web/lib/rosterScheduleOptimizer/planning.ts:948 [inline calculation: Expected goalie starts and minimum-coverage risk]`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per team game; generation: current
- **Opus view (RSO-028):**
  - Method: Per team-game: min(1, sum of start probabilities of rostered goalies started in that game; confirmed=1). expectedStarts = sum; projected = credited + expectedStarts (null if any probability unknown and minimum not met; null for 'appearances' or 'unknown' counts; null if window unverified). risk = hasMinimum && (projected null \|\| projected < required).
  - Inputs/units: start probability fraction 0-1; credited starts count; sources: FORGE goalie start shares, Yahoo starting status
  - Output scale: expected starts (real >= 0); risk boolean; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: compareEvaluations; streaming chain goalie need; candidatePlanMetrics goalieBoost; CandidateBrowser
- **Codex view (roster-plan-goalie-minimum, calculation, location; Codex family 'roster-planning'):** Expected goalie starts and minimum-coverage risk
  - Purpose: For assigned goalies sum start probabilities by team-game capped at 1, then sum team-games; combine credited starts with future expectations. Count confirmed starts separately.
  - Inputs/units: Probabilities 0–1, verified minimum window, required/credited starts or appearances, penalty rule.
  - Output scale: Expected starts (fractional count), confirmed count, projected total, risk/minimumSatisfied flags.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): planning.ts:968,970 comments (zero requirement bypass; unknown upcoming start keeps projected unknown, never a partial sum)
  - Intended contract (Codex roster-plan-goalie-minimum): Start probabilities do not establish appearance minimums; unknown required inputs/window withhold projected totals. Source: web/lib/rosterScheduleOptimizer/planning.ts:948.
  - External references: Expected value of Bernoulli starts; P(meet minimum) would need a Poisson-binomial
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/streamingChain.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 17, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) risk uses expected starts vs required (no probability of reaching the minimum), so 1.9 expected vs 2 required is 'risk' while P(>=2) may be high/low
  - (codex:roster-plan-goalie-minimum) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-021 Yahoo starting-goalie override of start probabilities

- **Match:** Both; Opus RSO-029; Codex roster-provider-starts
- **Purpose:** Replace FORGE bridge goalie start chances with Yahoo's daily starting mark.
- **Where:** `web/lib/rosterScheduleOptimizer/providerGoalieStarts.ts:18 (applyProviderGoalieStarts)`; `web/lib/rosterScheduleOptimizer/providerGoalieStarts.ts:18 applyProviderGoalieStarts`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (RSO-029):**
  - Method: 'Starting' -> that goalie p=1 (confirmed), teammates 0. 'Not starting' -> 0; remaining team rows rescaled p_i/sum(p_rest) (to sum 1). Expected stats = round4(perStartLine x p). Skipped if two starters, contradicts a confirmed starter, game started, or a row lacks per-start line.
  - Inputs/units: start probability fraction 0-1; per-start stat lines; sources: Yahoo player starting status, FORGE bridge forecasts
  - Output scale: start probability 0-1; expected stats rounded 4 dp; writes: —
  - Status: live — lib/integrations/yahoo/planningConfirmations.ts
  - Consumers: web/lib/integrations/yahoo/planningConfirmations.ts
- **Codex view (roster-provider-starts, calculation, location; Codex family 'roster-planning'):** Yahoo starter override probability redistribution
  - Purpose: Confirmed starter gets 1, teammates 0; not-starting gets 0 and remaining team mass is normalized to 1 where possible. Multiply conditional line by new probability, round 4 decimals.
  - Inputs/units: Fresh provider same-game starter marks and bridge per-start stats/probabilities.
  - Output scale: Start probability 0–1 and expected stat counts per game.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): providerGoalieStarts.ts:10-17 docstring
  - Intended contract (Codex roster-provider-starts): Only bridge rows; conflicts, started games and missing conditional lines leave issued rows unchanged. Source: web/lib/rosterScheduleOptimizer/providerGoalieStarts.ts:18 applyProviderGoalieStarts.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/e2e/roster-schedule-optimizer.spec.ts`; `web/lib/rosterScheduleOptimizer/providerGoalieStarts.test.ts`; `{"discovered_not_run": ["web/e2e/roster-schedule-optimizer.spec.ts", "web/components/RosterScheduleOptimizer/SlotWeekGrid.test.tsx", "web/lib/rosterScheduleOptimizer/providerGoalieStarts.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) rescale to 1 uses only the bridge rows present for that team-game; a team goalie missing from the rows (no share) is implicitly 0, inflating the others
  - (opus) a lone remaining goalie gets p=1 without confirmedStart
  - (codex:roster-provider-starts) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-022 Healthy-reserve activation gain

- **Match:** Both; Opus RSO-030; Codex roster-healthy-reserve-activation
- **Purpose:** Flag healthy players sitting in IR/IR+ and price activating them.
- **Where:** `web/lib/rosterScheduleOptimizer/healthyReserves.ts:54 (healthyReserves)`; `web/lib/rosterScheduleOptimizer/healthyReserves.ts:27 (isHealthyReserve)`; `web/lib/rosterScheduleOptimizer/healthyReserves.ts:34 (dtdReserves)`; `web/lib/rosterScheduleOptimizer/healthyReserves.ts:54 healthyReserves`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-030):**
  - Method: Healthy = IR/IR+ with injury null on a complete Yahoo read. Counterfactual base = roster without flagged players. Each option (open spot if activeSlots+bench - nonreserve > 0, or swap with a player eligible for that reserve slot) evaluated: gain points = projectedValue diff (points leagues), activeGames diff. Brute-force assignment maximizes lexicographic [activated count, sum points (unknown=0), sum games]. Weekly locked window: activated player bench-locked until next window.
  - Inputs/units: fantasy points; active games; sources: Yahoo roster (live, complete)
  - Output scale: activation option with gains (fantasy points, games); writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves); HealthyReserveAlert.tsx
  - Consumers: HealthyReserveAlert.tsx; RosterScheduleOptimizer.tsx
- **Codex view (roster-healthy-reserve-activation, calculation, location; Codex family 'roster-planning'):** Healthy-reserve activation gains and assignment
  - Purpose: Prices activation versus no flagged reserve playing: projectedPoints and activeGames differences from evaluatePlan. Enumerates open bench spots/eligible reserve swaps and brute-forces distinct choices, lexicographically maximizing number activated, summed known points, then active games; unknown gains count0 only in selection objective.
  - Inputs/units: Complete Yahoo roster/injury and reserve eligibility, active/bench capacity, forecasts, intent, current weekly lock.
  - Output scale: Per-player feasible activation/swap, points/AGP gain or null and next-window flag; no automatic move.
  - Version/status: Source comments reference 2026-10-25 policy decisions; source-only evidence. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): healthyReserves.ts:24-26, 64-66 (TJ 2026-10-25 policy 3 option A), 92-94 (C7 H1 assignment rule)
  - Intended contract (Codex roster-healthy-reserve-activation): Comments specify full live Yahoo injury-null gate and weekly locked players remain benched until next window. Structural activation count precedes points objective. Source: web/lib/rosterScheduleOptimizer/healthyReserves.ts:54 healthyReserves.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/components/RosterScheduleOptimizer/HealthyReserveAlert.test.tsx`; `web/lib/rosterScheduleOptimizer/healthyReserves.test.ts`; `{"discovered_not_run": ["web/lib/rosterScheduleOptimizer/healthyReserves.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) per-player gains are computed independently against the same base and then summed; with shared bench/active capacity they are not additive
  - (opus) brute force is exponential in flagged players (small in practice)
  - (codex:roster-healthy-reserve-activation) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-023 Position eligibility normalization and slot compatibility

- **Match:** Both; Opus RSO-031; Codex roster-slots-eligibility
- **Purpose:** Map provider position labels to canonical positions and decide which active slot types a player may fill.
- **Where:** `web/lib/rosterScheduleOptimizer/eligibility.ts:61 (normalizeEligibility)`; `web/lib/rosterScheduleOptimizer/eligibility.ts:85 (canEligibilityOccupySlot)`; `web/lib/rosterScheduleOptimizer/eligibility.ts:108 (compatibleActiveSlotTypes)`; `web/lib/rosterScheduleOptimizer/slots.ts:28 expandActiveSlots`; `web/lib/rosterScheduleOptimizer/eligibility.ts:61 normalizeEligibility`; `web/lib/rosterScheduleOptimizer/eligibility.ts:85 canEligibilityOccupySlot`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-031):**
  - Method: Split on , / \|, uppercase, alias map (CENTER/CENTRE->C, WING->W, DEF->D, GOALIE->G...). Valid only if non-empty, no unknown labels and not mixed skater+goalie. Goalie->G only; skater: UTIL any skater, F accepts C/LW/RW/F/W, W accepts LW/RW/W, else exact match. Canonical order C,LW,RW,F,W,D,UTIL,G.
  - Inputs/units: position label strings; sources: Yahoo league roster / yahoo eligibility cache
  - Output scale: boolean / canonical position list; writes: —
  - Status: live — used by DUST engine and RSO planner (planning.ts, streamingChain.ts, lineupGaps.ts)
  - Consumers: matching.ts; planning.ts assign/refine; streamingChain maxMatch; recommendations.ts; lineupGaps.ts
- **Codex view (roster-slots-eligibility, calculation, location; Codex family 'roster-schedule'):** Active/bench/reserve capacity and compatible slots
  - Purpose: Expand configured slot counts and classify eligibility into skater/goalie slots, including F/W/UTIL.
  - Inputs/units: League slot counts and positional labels.
  - Output scale: Integer active/bench/reserve capacities; compatibility booleans.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): docs/roster-schedule-optimizer.md:33 (multi-position eligibility changes the assignment graph, not a fixed discount)
  - Intended contract (Codex roster-slots-eligibility): Reserve and bench slots are not startable NHL games; unsupported/mixed labels produce diagnostics. Source: web/lib/rosterScheduleOptimizer/slots.ts:28 expandActiveSlots.
  - External references: Yahoo NHL roster position rules (C/LW/RW/W/F/D/Util/G)
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/__tests__/pages/api/v1/roster-schedule-optimizer/eligibility.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`; `web/lib/rosterScheduleOptimizer/optimizer.test.ts`; `{"discovered_not_run": ["web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts", "web/lib/rosterScheduleOptimizer/optimizer.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) a D-eligible player can fill UTIL (correct for Yahoo Util) but some leagues restrict Util to forwards; no league-specific Util rule
  - (opus) no direct test reference for compatibleActiveSlotTypes (rg); covered indirectly via recommendations
  - (codex:roster-slots-eligibility) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-024 Lineup gap report

- **Match:** Both; Opus RSO-032; Codex roster-lineup-gaps
- **Purpose:** Find empty active slots in the no-move lineup and adds that fill them.
- **Where:** `web/lib/rosterScheduleOptimizer/lineupGaps.ts:40 (lineupGapReport)`; `web/lib/rosterScheduleOptimizer/lineupGaps.ts:40 lineupGapReport`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-032):**
  - Method: Open slot = slot with no assignment on a date with playable games; grouped by date+slot type. bestDrop = lowest known contributor; adds kept if netPoints>0 or netAGP>0; fills = first open (or freed-by-drop) slot per add game date via eligibility; sort by netPoints (points leagues), netAGP, netPoints, fills, id; top 5.
  - Inputs/units: slot instances; fantasy points; active games; sources: —
  - Output scale: gap counts; top-5 adds; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: RosterScheduleOptimizer.tsx
- **Codex view (roster-lineup-gaps, calculation, location; Codex family 'roster-planning'):** Open slot counts and fill opportunities
  - Purpose: For future playable dates subtract occupied slot IDs from active slots, group by date/type, connect existing candidate plans and lowest known eligible drop.
  - Inputs/units: No-move assignments, active slots, contribution ledger and previously calculated candidate comparisons.
  - Output scale: Open slot count, gaps, fill dates, bestDrop/unknown-drop lists.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): lineupGaps.ts:38-39 (readback of no-move lineup, runs no search)
  - Intended contract (Codex roster-lineup-gaps): No new search; structural gaps and supported comparisons remain distinct. Source: web/lib/rosterScheduleOptimizer/lineupGaps.ts:40 lineupGapReport.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/lineupGaps.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`; `{"discovered_not_run": ["web/lib/rosterScheduleOptimizer/lineupGaps.test.ts", "web/lib/rosterScheduleOptimizer/planning.test.ts", "web/lib/rosterScheduleOptimizer/healthyReserves.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) an open slot is any unfilled slot instance even if no rostered player could have played that day - counts real streaming opportunity, but gap fills are greedy first-match
  - (codex:roster-lineup-gaps) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-025 DUST daily lineup assignment (min-cost max-flow)

- **Match:** Both; Opus RSO-033; Codex roster-slot-matching
- **Purpose:** Assign a day's scheduled roster players to active slot instances, maximising starts then player value.
- **Where:** `web/lib/rosterScheduleOptimizer/matching.ts:105 (assignPlayersToActiveSlots)`; `web/lib/rosterScheduleOptimizer/matching.ts:52 (normalizePlayers)`; `web/lib/rosterScheduleOptimizer/matching.ts:105 assignPlayersToActiveSlots`
- **Tags (heuristic):** generation: development, current
- **Opus view (RSO-033):**
  - Method: Bipartite graph source->player(cap1,cost0)->eligible slot(cap1,cost -value)->sink. Successive shortest augmenting paths with Bellman-Ford (EPSILON 1e-10) until no path: maximum cardinality first, then minimum cost (max total value) among max-cardinality matchings. Non-finite value -> 0 with warning. Players/slots sorted by id for deterministic ties; benched = valid players unmatched; invalid-eligibility players are 'unresolved' and excluded.
  - Inputs/units: player.value (external canonical value, unitless); one game per player-date; sources: roster_optimizer_team_games (via schedule)
  - Output scale: integer counts of started/benched player-games per day; writes: —
  - Status: live — lib/draft-pro/dust.ts called by pages/api/v1/draft-pro/dust.ts and lib/draftDashboard/draftProDustPresentation.ts; docs/roster-schedule-optimizer.md:83 says the Draft Dashboard route sits behind a maintenance notice
  - Consumers: evaluateRosterSchedule; calculateCandidateDust; web/lib/draft-pro/dust.ts (Draft Dashboard DUST badge)
- **Codex view (roster-slot-matching, calculation, location; Codex family 'roster-schedule'):** Daily maximum-cardinality, maximum-value slot assignment
  - Purpose: Build eligible player-slot bipartite flow; augment to maximum cardinality while minimizing negative player value. Return active assignments, bench and unresolved players.
  - Inputs/units: Player IDs, eligibility labels and comparable value; active slot instances; date/week.
  - Output scale: Integer scheduled/startable/bench/unresolved games and assigned value in input value units.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): docs/roster-schedule-optimizer.md '## Definitions' (lines 9-27) and '## Shared engine' (57-61): 'deterministic maximum-cardinality bipartite matching ... value-aware tie-break chooses starters without changing the maximum starter count'
  - Intended contract (Codex roster-slot-matching): One player per compatible active slot; unknown eligibility is unresolved. Stable IDs break equivalent cases. Source: web/lib/rosterScheduleOptimizer/matching.ts:105 assignPlayersToActiveSlots.
  - External references: Exact bipartite / min-cost-flow lineup assignment (Hungarian equivalent); Yahoo daily lineup rules
  - Fixtures/test data: `web/e2e/draft-pro-fixtures.ts`; `web/e2e/roster-schedule-optimizer-fixtures.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/optimizer.test.ts`; `{"discovered_not_run": ["web/lib/rosterScheduleOptimizer/optimizer.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) augments every path regardless of cost sign, so negative-value players still start (cardinality strictly dominates value) - intended per docs, but differs from planner assign() which can leave slots empty
  - (opus) Bellman-Ford per augmentation is O(V*E) per path; fine for one roster-day but repeated for every candidate x date in DUST loops
  - (codex:roster-slot-matching) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-026 Planner daily lineup assignment (Hungarian, AGP lexicographic bonus)

- **Match:** Both; Opus RSO-034; Codex web-lib-projections-weightedassignment-weightedassignment
- **Purpose:** Choose each day's (or weekly window's) starters for the planner under objective 'agp' (most active games) or 'outcome' (most points).
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:400 (assign)`; `web/lib/rosterScheduleOptimizer/planning.ts:469 (agpBonus)`; `web/lib/projections/weightedAssignment.ts:2 (weightedAssignment)`; `web/lib/projections/weightedAssignment.ts:2 weightedAssignment`
- **Tags (heuristic):** conditionality: conditional; generation: current
- **Opus view (RSO-034):**
  - Method: Locked slots fixed first. Exact rectangular max-weight matching (Hungarian, cost -value, ineligible 1e12, each slot may stay empty at cost 0). Weight: agp objective or category mode -> gamesCount x agpBonus + value where agpBonus = 1 + sum\|values\| (lexicographic: games first, value tie-break); outcome (points) -> value only (null excluded); unknown-quality components -> gamesCount x agpBonus + conditional tie-break; forced player +agpBonus.
  - Inputs/units: fantasy points per play; gamesCount; sources: FORGE forecasts, provider lineup locks
  - Output scale: slot->player assignment; internal weight = games x (1+sum\|values\|) + points; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: evaluatePreparedPlan; bench decision forced placements
- **Codex view (web-lib-projections-weightedassignment-weightedassignment, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Weighted assignment (weightedAssignment)
  - Purpose: Exact rectangular maximum-weight matching with an independent empty choice for each slot.
  - Inputs/units: Parameter/type declaration excerpt: export function weightedAssignment<Slot, Player>( slots: readonly Slot[], players: readonly Player[], weight: (slot: Slot, player: Player) => number \| null, ): Array<{ slotIndex: number; playerIndex: number \| null }> { const n = slots.length, m = players.length + n; const u = Array<number>(n + 1).fill(0), v = Array<number>(m + 1).fill(0); const p = Array<number>(m + 1).fill(0), way = Array<number>(m + 1).fill(0); const values = slots.map(slot => players.map(player => weight(slot, player))); const cost = (row: number, col: number) => { if (col > players.length) return 0; const value = values[row - 1][col - 1]; return value === null \|\| !Number.isFinite(value) ? 1e12 : -value; }; for (let row = 1; row <= n; row++) { p[0] = row; let col = 0; const min =…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): weightedAssignment.ts:1 ('Exact rectangular maximum-weight matching with an independent empty choice for each slot'); tasks/prd-roster-schedule-optimizer.md; tasks/tasks-prd-rso-consolidated-2026-10-09.md
  - Intended contract (Codex web-lib-projections-weightedassignment-weightedassignment): {"source": "web/lib/projections/weightedAssignment.ts:2", "explicit_comment": "Exact rectangular maximum-weight matching with an independent empty choice for each slot.", "arithmetic_locations": []}
  - External references: Hungarian / ILP lineup optimisation (exact per day; not a multi-day joint optimisation)
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/projections/startChartPipeline.test.ts (weightedAssignment)`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.e2e.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/startChartPipeline.test.ts:19"]}`
- **Leads (not audited):**
  - (opus) in 'outcome' points mode, empty slot (0) ties or beats players with value <= 0, so zero/negative-projection players can be left out and active games drop; diverges from DUST's max-cardinality rule in docs
  - (opus) per-day matching is myopic; no cross-day constraints (fine for daily leagues)
  - (codex:web-lib-projections-weightedassignment-weightedassignment) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-RSO-027 Active roster slot expansion

- **Match:** Both; Opus RSO-039; Codex roster-slots-eligibility
- **Purpose:** Expand league roster slot counts into active slot instances, bench and inactive capacity.
- **Where:** `web/lib/rosterScheduleOptimizer/slots.ts:28 (expandActiveSlots)`; `web/lib/rosterScheduleOptimizer/slots.ts:28 expandActiveSlots`; `web/lib/rosterScheduleOptimizer/eligibility.ts:61 normalizeEligibility`; `web/lib/rosterScheduleOptimizer/eligibility.ts:85 canEligibilityOccupySlot`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-039):**
  - Method: Aliases (FWD->F, UTILITY->UTIL); BN/BENCH/BE summed to benchCapacity; IR/IR+/NA/IL/IL+ to inactiveCapacity; others -> slot instances id 'TYPE#n' in canonical order; non-integer or negative counts and unknown labels -> error diagnostics.
  - Inputs/units: slot counts (integers); sources: Yahoo league settings / manager overrides
  - Output scale: slot instance list; integer bench/inactive capacity; writes: —
  - Status: live — shared by DUST engine and RSO planner
  - Consumers: optimizer.ts; planning.ts; planningTimeline capacity; healthyReserves; streamingChain
- **Codex view (roster-slots-eligibility, calculation, location; Codex family 'roster-schedule'):** Active/bench/reserve capacity and compatible slots
  - Purpose: Expand configured slot counts and classify eligibility into skater/goalie slots, including F/W/UTIL.
  - Inputs/units: League slot counts and positional labels.
  - Output scale: Integer active/bench/reserve capacities; compatibility booleans.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): docs/roster-schedule-optimizer.md '## Definitions' (lines 9-27) and '## Shared engine' (57-61)
  - Intended contract (Codex roster-slots-eligibility): Reserve and bench slots are not startable NHL games; unsupported/mixed labels produce diagnostics. Source: web/lib/rosterScheduleOptimizer/slots.ts:28 expandActiveSlots.
  - External references: Yahoo roster positions
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`; `web/lib/rosterScheduleOptimizer/optimizer.test.ts`; `{"discovered_not_run": ["web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts", "web/lib/rosterScheduleOptimizer/optimizer.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-slots-eligibility) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-028 Streaming per-day capacity via bipartite matching

- **Match:** Both; Opus RSO-040; Codex roster-streaming-chain-search
- **Purpose:** Count startable players per day for streaming gains.
- **Where:** `web/lib/rosterScheduleOptimizer/streamingChain.ts:83 (maxMatch)`; `web/lib/rosterScheduleOptimizer/streamingChain.ts:162 (capacity)`; `web/lib/rosterScheduleOptimizer/streamingChain.ts:96 buildStreamingChains`; `web/lib/rosterScheduleOptimizer/streamingChain.ts:83 maxMatch`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-040):**
  - Method: Kuhn augmenting-path maximum-cardinality matching over eligibility; capacity = fixed locked slots + matched count; memoized by (day, removed, extras).
  - Inputs/units: slot types, eligibility; sources: —
  - Output scale: integer started count per day; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: runSpot gain/loss
- **Codex view (roster-streaming-chain-search, calculation, location; Codex family 'roster-planning'):** One/two-spot streaming-chain optimizer
  - Purpose: Use per-day maximum matching and dynamic programming across contiguous streaming windows and adds budget; pair limited drop candidates; prioritize minimum coverage when requested.
  - Inputs/units: Daily candidate games/eligibility, starts, acquisition timing, budget, projected/recent score and exclusions.
  - Output scale: Certified one/two-spot chain, gains, alternatives and search truncation.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): streamingChain.ts:11 ('small per-day matchings')
  - Intended contract (Codex roster-streaming-chain-search): Heuristic proposal stage followed by complete-plan certification; waiver claims only under verified priority rules. Source: web/lib/rosterScheduleOptimizer/streamingChain.ts:96 buildStreamingChains.
  - External references: Maximum bipartite matching
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/streamingChain.test.ts`; `{"discovered_not_run": ["web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/rosterScheduleOptimizer/streamingChain.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) capacity ignores player value, so 'gain' days may displace a better rostered skater only in counting terms (points handled separately)
  - (codex:roster-streaming-chain-search) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-029 Acquisition timeline, effective time and budget accounting

- **Match:** Both; Opus RSO-045; Codex roster-plan-active-games
- **Purpose:** Apply add/drop/reserve steps at effective time, enforce capacity and charge acquisition allowances.
- **Where:** `web/lib/rosterScheduleOptimizer/planningTimeline.ts:13 (acquisitionEffectiveAt)`; `web/lib/rosterScheduleOptimizer/planningTimeline.ts:25 (buildTimeline)`; `web/lib/rosterScheduleOptimizer/planning.ts:647 evaluatePlan`; `web/lib/rosterScheduleOptimizer/planning.ts:1025 [inline calculation: Plan scheduled/active/bench games and acquisitions]`; `web/lib/rosterScheduleOptimizer/planningTimeline.ts:25 buildTimeline`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-045):**
  - Method: Effective = action time (same-day) or next league-local midnight (next_day), pushed to waiverClearsAt for waivers. Steps sorted by effective then action time with dependency order. Charge acquisitionCost (defaults 1 if null) to the period containing action time; exceeding remaining -> illegal; budget-mode waiver spend summed vs remainingBudget. Capacity: non-reserve <= active+bench; each reserve <= its slots. Locks block moves until next local midnight or weekly window end.
  - Inputs/units: ISO instants; acquisition counts/cost; waiver budget dollars; sources: Yahoo league settings / transactions
  - Output scale: roster map; acquisitions per period; booleans; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: evaluatePreparedPlan; reconcileIntent; futureImpact boundaryRosters; contributionLedger
- **Codex view (roster-plan-active-games, calculation, location; Codex family 'roster-planning'):** Plan scheduled/active/bench games and acquisitions
  - Purpose: Count planned assignments excluding held/started rows; bench=max(0,scheduled-planned); timeline applies effective acquisitions/drops/reserves and counts cost against period budgets.
  - Inputs/units: Future schedule, roster, dated plan steps, provider lock/acquisition rules and budgets.
  - Output scale: Integer player-games and acquisition counts/cost; legal/budgetVerified booleans.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): planningTimeline.ts:12, 24 ('Applies actions at their effective time while charging acquisition at action time')
  - Intended contract (Codex roster-plan-active-games): Current dated planning differs from static DUST. Counts describe evaluator assignments, not predicted actual appearances. Source: web/lib/rosterScheduleOptimizer/planning.ts:647 evaluatePlan.
  - External references: Yahoo max acquisitions per week, waiver processing
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/integrations/yahoo/rosterPlanning.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/reconciliation.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 33, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) acquisitionCost null silently charged as 1 (budgetVerified false but legal)
  - (codex:roster-plan-active-games) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-030 Drop retention ordering and ownership caution

- **Match:** Both; Opus RSO-049; Codex roster-retention-order
- **Purpose:** Rank droppable roster players by known contribution; flag high-demand drops.
- **Where:** `web/lib/rosterScheduleOptimizer/retention.ts:54 (orderDropCandidates)`; `web/lib/rosterScheduleOptimizer/retention.ts:81 (knownDropOrder)`; `web/lib/rosterScheduleOptimizer/retention.ts:71 (suggestedDrop)`; `web/lib/rosterScheduleOptimizer/retention.ts:29 (retentionCaution)`; `web/lib/rosterScheduleOptimizer/planning.ts:1314 (noMoveDropOrder)`; `web/lib/rosterScheduleOptimizer/retention.ts:54 orderDropCandidates`; `web/lib/rosterScheduleOptimizer/retention.ts:81 knownDropOrder`; `web/lib/rosterScheduleOptimizer/retention.ts:91 droppedOwnership`; `web/lib/rosterScheduleOptimizer/retention.ts:29 retentionCaution`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-049):**
  - Method: Tiers: projected assigned points (points leagues) then no-move active games; lowest first; exact ties by ownership asc only when all known, else holdValue then id. Unknown in all tiers -> never auto-proposed. dropEligible: canDrop, not protected, not reserve-held, not injury IR/IR-LT/IR-NR/O. High-demand caution at ownership >= 50%.
  - Inputs/units: fantasy points; active games; ownership percent 0-100; sources: yahoo_player_ownership_daily
  - Output scale: rank map 0..N-1; caution enum; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: planRoster extensions; streamingChain drops; candidatePlanMetrics; lineupGaps
- **Codex view (roster-retention-order, calculation, location; Codex family 'roster-planning'):** Drop contribution ordering and ownership caution
  - Purpose: Order lowest known contribution first; exact tie groups use ascending ownership only if all known, then holdValue/id. Plan ownership is max across drops. Ownership≥50 triggers caution.
  - Inputs/units: Contribution in points or active games; ownership percent 0–100; holdValue; protected/reserve/out flags.
  - Output scale: Drop rank, max dropped ownership percent, caution label.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): retention.ts:3-4 (R7 one retention policy), :6 (50% threshold TJ 2026-10-20), :68-70 (TJ 2026-10-21 unknown never suggested)
  - Intended contract (Codex roster-retention-order): Ownership is platform demand, not league availability or claim probability; it never changes objective values. Source: web/lib/rosterScheduleOptimizer/retention.ts:54 orderDropCandidates.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts`; `web/lib/rosterScheduleOptimizer/retention.test.ts`; `web/lib/rosterScheduleOptimizer/streamingChain.test.ts`; `{"discovered_not_run": ["web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts", "web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts", "web/lib/rosterScheduleOptimizer/streamingChain.test.ts", "web/lib/rosterScheduleOptimizer/retention.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) bridge 'no FORGE line' players carry a known 0 forecast, so they rank as lowest known contributors and become first drop proposals despite the 'unknown is never auto-dropped' policy
  - (opus) magic number: 50% ownership threshold
  - (codex:roster-retention-order) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-031 Candidate marginal DUST (Daily Unstartable Schedule Tax)

- **Match:** Both; Opus RSO-050; Codex roster-candidate-dust
- **Purpose:** Marginal bench games caused by adding one candidate to the roster.
- **Where:** `web/lib/rosterScheduleOptimizer/optimizer.ts:365 (calculateCandidateDust)`; `web/lib/rosterScheduleOptimizer/optimizer.ts:365 calculateCandidateDust`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per team game; generation: development, current
- **Opus view (RSO-050):**
  - Method: For each candidate team-game date: re-run matching with roster+candidate. marginalDustGames = sum(benchAfter - benchBefore); activeGamesAdded = candidateScheduledGames - marginalDustGames; dustRate = marginalDust / candidateScheduledGames; also candidate started/benched counts and displaced roster starters; weekly breakdown.
  - Inputs/units: player-games (counts); sources: roster_optimizer_team_games
  - Output scale: marginalDustGames integer; dustRate fraction 0-1; writes: —
  - Status: live — lib/draft-pro/dust.ts called by pages/api/v1/draft-pro/dust.ts and lib/draftDashboard/draftProDustPresentation.ts; docs/roster-schedule-optimizer.md:83 says the Draft Dashboard route sits behind a maintenance notice
  - Consumers: web/lib/draft-pro/dust.ts; classifyDustRisk; rankAlternativeRecommendations
- **Codex view (roster-candidate-dust, calculation, location; Codex family 'roster-schedule'):** Marginal DUST, active games added and displaced roster games
  - Purpose: Re-evaluate each candidate team-date after adding the player; sum after-minus-before bench games, candidate starts/bench attribution and displaced prior starters.
  - Inputs/units: Baseline roster evaluation plus candidate player and schedule.
  - Output scale: Integer candidate scheduled/startable/benched/displaced games, marginal bench games, activeGamesAdded; dustRate fraction.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): docs/roster-schedule-optimizer.md:19-24 (DUST Games, DUST Rate, Active Games Added formulas)
  - Intended contract (Codex roster-candidate-dust): Candidate add comparison; attribution and marginal congestion are separate outputs. Source: web/lib/rosterScheduleOptimizer/optimizer.ts:365 calculateCandidateDust.
  - External references: Marginal games-started added (streaming value) - docs/roster-schedule-optimizer.md formula
  - Fixtures/test data: `web/e2e/draft-pro-fixtures.ts`; `web/e2e/roster-schedule-optimizer-fixtures.ts`
  - Tests: `web/lib/draft-pro/dust.test.ts`; `web/lib/rosterScheduleOptimizer/optimizer.test.ts`; `{"discovered_not_run": ["web/lib/draft-pro/dust.test.ts", "web/lib/rosterScheduleOptimizer/optimizer.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) does not account for bench capacity (candidate added beyond roster size) - assumes a free roster spot
  - (codex:roster-candidate-dust) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-032 Lower-conflict alternative recommendations

- **Match:** Both; Opus RSO-051; Codex roster-dust-alternatives
- **Purpose:** Rank same-class alternatives that reduce DUST without losing much value.
- **Where:** `web/lib/rosterScheduleOptimizer/recommendations.ts:13 (rankAlternativeRecommendations)`; `web/lib/rosterScheduleOptimizer/types.ts:252 (DEFAULT_RECOMMENDATION_THRESHOLDS)`; `web/lib/rosterScheduleOptimizer/recommendations.ts:13 rankAlternativeRecommendations`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: development, current
- **Opus view (RSO-051):**
  - Method: Require available, same player class, overlapping non-UTIL slot type; dustImprovement >= max(2, ceil(candidateDust x 0.25)); relativeValueLoss = max(0, candValue-altValue)/candValue <= 0.05 (Infinity if candidate value<=0); optional absolute cap. Sort by dustImprovement desc, valueDifference desc, value desc, id.
  - Inputs/units: dust games (count); player.value (unitless); value loss fraction; sources: —
  - Output scale: sorted list; relativeValueLoss fraction 0-1; writes: —
  - Status: live — lib/draft-pro/dust.ts called by pages/api/v1/draft-pro/dust.ts and lib/draftDashboard/draftProDustPresentation.ts; docs/roster-schedule-optimizer.md:83 says the Draft Dashboard route sits behind a maintenance notice
  - Consumers: web/lib/draft-pro/dust.ts
- **Codex view (roster-dust-alternatives, calculation, location; Codex family 'roster-schedule'):** DUST alternative score and value-loss filter
  - Purpose: Compare compatible same-class candidates: dust improvement = original minus alternative; require max(minimum,ceil(relative×original)); reject excessive absolute/relative value loss; sort by dust improvement then value.
  - Inputs/units: Candidate/alternative marginal bench games, comparable value and eligibility, threshold policy.
  - Output scale: Ranked alternatives; dust reduction (games), value difference, fractional value loss.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): docs/roster-schedule-optimizer.md:77 (max(2, ceil(DUST x 25%)), <=5% value loss, ordering)
  - Intended contract (Codex roster-dust-alternatives): Requires overlapping non-UTIL compatible slot; not a trade valuation. Source: web/lib/rosterScheduleOptimizer/recommendations.ts:13 rankAlternativeRecommendations.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/draft-pro-fixtures.ts`; `web/e2e/roster-schedule-optimizer-fixtures.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/optimizer.test.ts`; `{"discovered_not_run": ["web/lib/rosterScheduleOptimizer/optimizer.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) magic numbers: 2 games, 25%, 5% value loss
  - (opus) 'value' is an external canonical value of unknown scale; relative loss undefined for non-positive values
  - (codex:roster-dust-alternatives) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-033 DUST risk classification

- **Match:** Both; Opus RSO-052; Codex roster-dust-risk
- **Purpose:** Label a candidate's schedule conflict as low/moderate/elevated/high.
- **Where:** `web/lib/rosterScheduleOptimizer/risk.ts:20 (classifyDustRisk)`; `web/lib/rosterScheduleOptimizer/types.ts:271 (DEFAULT_DUST_RISK_THRESHOLDS)`; `web/lib/rosterScheduleOptimizer/risk.ts:20 classifyDustRisk`; `web/lib/rosterScheduleOptimizer/types.ts:271 [inline calculation: DUST risk label]`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: development, current
- **Opus view (RSO-052):**
  - Method: rate = max(0,dust)/scheduled; label = highest tier where BOTH games>=min and rate>=min: moderate (2, 0.05), elevated (4, 0.10), high (7, 0.15); else low.
  - Inputs/units: dust games (count); rate fraction 0-1; sources: —
  - Output scale: ordinal label low/moderate/elevated/high; writes: —
  - Status: live — lib/draft-pro/dust.ts called by pages/api/v1/draft-pro/dust.ts and lib/draftDashboard/draftProDustPresentation.ts; docs/roster-schedule-optimizer.md:83 says the Draft Dashboard route sits behind a maintenance notice
  - Consumers: Draft Dashboard DUST +N badge
- **Codex view (roster-dust-risk, calculation, location; Codex family 'roster-schedule'):** DUST risk label
  - Purpose: Clamp counts nonnegative, divide marginal DUST by scheduled games, then require both count and fraction threshold: moderate 2/5%, elevated 4/10%, high 7/15%.
  - Inputs/units: Marginal bench games; candidate scheduled games; optional thresholds.
  - Output scale: low/moderate/elevated/high and fraction.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): docs/roster-schedule-optimizer.md '## Recommendations and risk thresholds' (67-77); thresholds called initial product defaults at :128
  - Intended contract (Codex roster-dust-risk): Threshold classification, not probability. Source: web/lib/rosterScheduleOptimizer/risk.ts:20 classifyDustRisk.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/draft-pro-fixtures.ts`; `web/e2e/roster-schedule-optimizer-fixtures.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/optimizer.test.ts`; `{"discovered_not_run": ["web/components/RosterScheduleOptimizer/SlotWeekGrid.test.tsx", "web/lib/rosterScheduleOptimizer/optimizer.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) magic numbers: thresholds 2/4/7 games and 5%/10%/15% are 'initial product defaults' (docs line 128), unvalidated
  - (opus) a 7-dust candidate over a full season (rate tiny) never reaches 'high' - rate gate depends on horizon length
  - (codex:roster-dust-risk) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-034 Roster Autopsy slot coverage analysis

- **Match:** Both; Opus RSO-053; Codex roster-autopsy-coverage
- **Purpose:** Structural check whether a roster can fill league starting slots simultaneously.
- **Where:** `web/lib/rosterAutopsy/manual.ts:186 (analyzeRoster)`; `web/lib/rosterAutopsy/manual.ts:157 (parseSlotCounts)`; `web/lib/rosterAutopsy/manual.ts:169 (mayHaveUnspecifiedPosition)`; `web/lib/rosterAutopsy/diagnosis.ts:8 (diagnoseRoster)`; `web/lib/rosterAutopsy/manual.ts:186 analyzeRoster`; `web/lib/rosterAutopsy/manual.ts:217 retainedRecentPoints`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-053):**
  - Method: Slots 0..25 each, total <= MAX_STARTING_SLOTS. Bipartite assignment (assignPlayersToActiveSlots from RSO matching) with every player value 1 = maximum cardinality matching. Per position: short if eligible < dedicated slots; needs_review if generic F/W/UTIL eligibility. Unfilled = totalSlots - assignments.
  - Inputs/units: counts; sources: browser localStorage workspace / RSO import
  - Output scale: categorical states; counts; writes: —
  - Status: live — /roster-autopsy
  - Consumers: pages/roster-autopsy.tsx
- **Codex view (roster-autopsy-coverage, calculation, location; Codex family 'Trade and roster autopsy'):** Roster autopsy structural slot coverage and recent-point hint
  - Purpose: Runs active-slot matcher using uniform player value1, diagnoses unfilled/covered eligible positions and unresolved eligibility. Recent point hint delegates retained historical recent-form scoring where complete.
  - Inputs/units: Manually entered roster eligibility, active slot counts, optional retained recent stats and point weights.
  - Output scale: Maximum fill counts, unfilled slots/diagnosis and optional recent fantasy-points hint.
  - Version/status: Local manual roster-autopsy workflow. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/rosterAutopsy/diagnosis.ts:7; manual.ts:168
  - Intended contract (Codex roster-autopsy-coverage): manual.ts and roster-autopsy diagnosis source distinguish structural evidence from schedule/projection analysis. Source: web/lib/rosterAutopsy/manual.ts:186 analyzeRoster.
  - External references: Maximum bipartite matching (Hopcroft-Karp) for slot feasibility
  - Fixtures/test data: none listed
  - Tests: `web/components/RosterAutopsy/RosterAutopsy.test.tsx`; `{"discovered_not_run": ["web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/lib/rosterAutopsy/diagnosis.test.ts", "web/lib/rosterAutopsy/manual.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) 'short' compares eligible count only to dedicated slots, ignoring that the same player may be counted for two positions
  - (codex:roster-autopsy-coverage) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-035 Plan ordering and safe-alternative gate

- **Match:** Both; Opus RSO-055; Codex roster-roster-plan-search
- **Purpose:** Sort candidate plans and decide which are safe improvements over the no-move baseline.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:1120 (compareEvaluations)`; `web/lib/rosterScheduleOptimizer/planning.ts:1146 (safeAlternative)`; `web/lib/rosterScheduleOptimizer/planning.ts:1331 planRoster`; `web/lib/rosterScheduleOptimizer/planning.ts:1120 compareEvaluations`; `web/lib/rosterScheduleOptimizer/planning.ts:1076 compareCategoryEvaluations`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-055):**
  - Method: Preferred objective first; categories: coverage diff then activeGames (agp). Points: goalie risk (cover), coverage min(target, projected), activeGames (agp), projectedValue (else assignmentValue), activeGames, preferred-window goalie starts. Safe: agp with more active games and points not lower (unknown allowed); else projected value >= baseline and (strictly better or more games or better coverage/risk).
  - Inputs/units: activeGames counts; fantasy points; expected starts; sources: —
  - Output scale: comparator sign; boolean; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: planRoster
- **Codex view (roster-roster-plan-search, calculation, location; Codex family 'roster-planning'):** Bounded roster-plan objective search
  - Purpose: Evaluate no-move and bounded transaction candidates/beam alternatives; compare permitted points or active-games objectives with goalie-coverage priority and category partial-order constraints.
  - Inputs/units: Plan intent, legal step candidates, all evaluator inputs, beam/work budgets.
  - Output scale: Ranked plan alternatives with exact evaluated totals, truncation diagnostics.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (only inline comments planning.ts:1123-1124, 1157-1158)
  - Intended contract (Codex roster-roster-plan-search): Heuristic bounded search is not a global optimality proof; facts and recommendations have separate eligibility. Source: web/lib/rosterScheduleOptimizer/planning.ts:1331 planRoster.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 24, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) agp plans with drops are 'safe' when projected points are unknown (net points cost unknown, disclosed in reasons)
  - (codex:roster-roster-plan-search) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-036 Search work quotas

- **Match:** Both; Opus RSO-056; Codex roster-search-work-quota
- **Purpose:** Deterministic evaluation budgets scaled by date range and available-player count.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:1176 (defaultWorkQuotas)`; `web/lib/rosterScheduleOptimizer/planning.ts:1176 defaultWorkQuotas`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-056):**
  - Method: days = end-start+1; rangeScale = sqrt(ceil(days/14)); scale = sqrt(ceil(days/14) x ceil(max(1,available)/25)); evaluations = max(12, floor(250/scale)); fitGroups = max(4, floor(80/scale)); benchEvaluations = max(12, floor(250/rangeScale)).
  - Inputs/units: days; player counts; sources: —
  - Output scale: integer evaluation budgets; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: planRoster; scheduleFits; bench explanations
- **Codex view (roster-search-work-quota, calculation, location; Codex family 'roster-planning'):** Deterministic search workload budgets
  - Purpose: Scale by sqrt(ceil(days/14)×ceil(max(1,available)/25)); evaluation/fit quotas max(12,floor(250/scale)) and max(4,floor(80/scale)); bench quota uses date-only sqrt.
  - Inputs/units: Horizon day count and available-candidate count.
  - Output scale: Integer evaluation/fit/bench work limits.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): planning.ts:1182-1183 ('work bounds, not wall-clock guesses, so identical inputs visit the same frontier')
  - Intended contract (Codex roster-search-work-quota): Operational search bound, not sports performance metric; independent of wall-clock estimates. Source: web/lib/rosterScheduleOptimizer/planning.ts:1176 defaultWorkQuotas.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 17, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) magic numbers: 250, 80, 12, 4, 14-day and 25-player buckets
  - (codex:roster-search-work-quota) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-037 Schedule fits (marginal active games by team/position group)

- **Match:** Both; Opus RSO-057; Codex roster-schedule-fits
- **Purpose:** Estimate added active games from one hypothetical extra bench player per team+position group.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:1191 (scheduleFits)`; `web/lib/rosterScheduleOptimizer/planning.ts:1191 scheduleFits`; `web/lib/rosterScheduleOptimizer/planning.ts:1580 candidateMetrics`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-057):**
  - Method: For each group (sorted, capped by fitGroups, optional time budget), evaluate roster + representative player with BN+1 under 'agp' and accept_risk; addedGames = activeGames - baseline.activeGames; keep >0 (or >=0 when includeZero); dates with more assignments. Sort addedGames desc.
  - Inputs/units: player-games; sources: roster_optimizer_team_games
  - Output scale: addedGames integer per team/position group; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: shortlist; candidateMetrics
- **Codex view (roster-schedule-fits, calculation, location; Codex family 'roster-planning'):** Candidate marginal active games by schedule fit
  - Purpose: Group by team/eligibility, add one hypothetical bench place and subtract no-move AGP. Return dates with greater assignment counts.
  - Inputs/units: Baseline planning evaluation, available players, schedule and slots.
  - Output scale: Added active games and improving dates; completeness/truncation flags.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): planning.ts:1175 ('Marginal lineup capacity only: one hypothetical extra roster place, no acquisition/drop claim')
  - Intended contract (Codex roster-schedule-fits): Capacity benefit only; does not itself account for executable drop/acquisition constraints. Source: web/lib/rosterScheduleOptimizer/planning.ts:1191 scheduleFits.
  - External references: Games-per-week streaming target identification
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 19, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) assumes an extra bench spot (no drop), so overstates realistic gains on full rosters
  - (codex:roster-schedule-fits) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-038 Roster plan beam search (add/drop/reserve sequences)

- **Match:** Both; Opus RSO-058; Codex roster-roster-plan-search
- **Purpose:** Search multi-step acquisition plans under agp and outcome objectives.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:1331 (planRoster)`; `web/lib/rosterScheduleOptimizer/planning.ts:1257 (extensions)`; `web/lib/rosterScheduleOptimizer/planning.ts:1329 (BEAM_RESERVE, DISTINCT_DROP_SLOTS)`; `web/lib/rosterScheduleOptimizer/planning.ts:1331 planRoster`; `web/lib/rosterScheduleOptimizer/planning.ts:1120 compareEvaluations`; `web/lib/rosterScheduleOptimizer/planning.ts:1076 compareCategoryEvaluations`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-058):**
  - Method: Objective = outcome only if no-move outcome is recommendation-eligible else agp. Depth loop maxSteps (default 4), beam width 8 (frontier = no-move + top 7), per-depth phase budget floor((maxEvals-3)/(maxSteps x 2)); proposals interleave candidates by date index; action time = zoned midnight (minus 1 day for next_day); each proposal yields add-only, reserve-prerequisite, top-2 drops, then remaining drops. Beam reserve: up to 2 pruned states with unseen drop sets get one more move. Category mode keeps non-dominated plans; up to 2 distinct-drop alternatives shown.
  - Inputs/units: plan steps (ISO instants), evaluations; sources: —
  - Output scale: ranked PlanEvaluation list; search stats; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: executionAdapter -> RosterScheduleOptimizer UI
- **Codex view (roster-roster-plan-search, calculation, location; Codex family 'roster-planning'):** Bounded roster-plan objective search
  - Purpose: Evaluate no-move and bounded transaction candidates/beam alternatives; compare permitted points or active-games objectives with goalie-coverage priority and category partial-order constraints.
  - Inputs/units: Plan intent, legal step candidates, all evaluator inputs, beam/work budgets.
  - Output scale: Ranked plan alternatives with exact evaluated totals, truncation diagnostics.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): planning.ts:1327-1328 (VORP S1 beam reserve bounds), tasks/diaries/2026-10-29-claude-rso-vorp-assessment.md; tasks/prd-roster-schedule-optimizer.md; tasks/tasks-prd-rso-consolidated-2026-10-09.md
  - Intended contract (Codex roster-roster-plan-search): Heuristic bounded search is not a global optimality proof; facts and recommendations have separate eligibility. Source: web/lib/rosterScheduleOptimizer/planning.ts:1331 planRoster.
  - External references: Beam search vs exact ILP/MIP over add/drop sequences
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.e2e.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts`; `web/lib/rosterScheduleOptimizer/refreshForecastInputs.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 24, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) magic numbers: beam 8, maxSteps 4, maxCandidates 40, reserve 2, distinct drops 2
  - (opus) search 'complete' flag is usually false (any pruning) - plans are best-found, not optimal
  - (codex:roster-roster-plan-search) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-039 Streaming chain window DP (1 vs 2 spots)

- **Match:** Both; Opus RSO-060; Codex roster-streaming-blend, roster-streaming-chain-search
- **Purpose:** Build day-by-day add/drop chains that spend the period's adds for most added active games, then points.
- **Where:** `web/lib/rosterScheduleOptimizer/streamingChain.ts:96 (buildStreamingChains)`; `web/lib/rosterScheduleOptimizer/streamingChain.ts:205 (runSpot)`; `web/lib/rosterScheduleOptimizer/streamingChain.ts:63 (better)`; `web/lib/rosterScheduleOptimizer/streamingChain.ts:96 buildStreamingChains`; `web/lib/rosterScheduleOptimizer/streamingChain.ts:183 [inline calculation: Streamer projected/recent blend and certified chain net score]`; `web/lib/rosterScheduleOptimizer/streamingChain.ts:326 [inline calculation: Streamer projected/recent blend and certified chain net score]`; `web/lib/rosterScheduleOptimizer/streamingChain.ts:83 maxMatch`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-060):**
  - Method: Daily leagues only. budget = floor(period.remaining / acquisitionCost), one acquisition period. Per drop: capacity gain per day = maxMatch(with player) - maxMatch(without). Windows [start,end): candidate plays on days with gain>0 (first day only if claim before puck drop); ranked list top 12. DP best[start][used] = max over end of leg(ranked[0]) + best[end][used+1] (last leg held to end); value compares min(need, starts), then (pointsFirst) points, then games, then points, then fewer adds (1e-9 tolerance). Subtract dropped player's lost games/points/starts from start. Singles: first 3 drops always, more while work <= 2,000,000 and before deadline. Pairs: top 4 single drops, all splits of budget, second spot on top of first. Two-spot recommended only if it beats one-spot.
  - Inputs/units: per-day capacity counts; blended fantasy points; adds (acquisition allowance / cost); sources: FORGE forecasts, wgo_skater_stats / wgo_goalie_stats (recent form)
  - Output scale: chains with netGames integer, netPoints/netScore fantasy points; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves) (planRoster result.streaming; StreamingItinerary.tsx)
  - Consumers: StreamingItinerary.tsx; planRoster result.streaming
- **Codex view (roster-streaming-blend, calculation, location; Codex family 'roster-planning'):** Streamer projected/recent blend and certified chain net score
  - Purpose: Per game use (forecast FP + recent last-10 FP/G)/2 when both available, else forecast; sum chain assignments and subtract no-move blend. Certified plan evaluator supplies separate netPoints/netGames.
  - Inputs/units: Forecast FP/game, historical FP/G, team schedules, slot capacity, acquisitions and drop contribution.
  - Output scale: Heuristic blended points, certified signed net FP and net AGP; adds used.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-streaming-chain-search, calculation, location; Codex family 'roster-planning'):** One/two-spot streaming-chain optimizer
  - Purpose: Use per-day maximum matching and dynamic programming across contiguous streaming windows and adds budget; pair limited drop candidates; prioritize minimum coverage when requested.
  - Inputs/units: Daily candidate games/eligibility, starts, acquisition timing, budget, projected/recent score and exclusions.
  - Output scale: Certified one/two-spot chain, gains, alternatives and search truncation.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): streamingChain.ts:9-19 (TJ 2026-10-27: most added active games then projected FPts; goalie minimum; waivers); tasks/diaries/2026-10-27-claude-rso-streaming-chain.md, tasks/diaries/2026-10-27-claude-rso-chain-limits.md
  - Intended contract (Codex roster-streaming-blend): Blended score is for chain search/ranking; emitted legality and objective totals come from complete evaluator, not proposals. Source: web/lib/rosterScheduleOptimizer/streamingChain.ts:96 buildStreamingChains.
  - Intended contract (Codex roster-streaming-chain-search): Heuristic proposal stage followed by complete-plan certification; waiver claims only under verified priority rules. Source: web/lib/rosterScheduleOptimizer/streamingChain.ts:96 buildStreamingChains.
  - External references: Streaming games-per-week maximisation; DP over add budget
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx`; `web/lib/rosterScheduleOptimizer/streamingChain.test.ts`; `{"discovered_not_run": ["web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/rosterScheduleOptimizer/streamingChain.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) DP leg value uses each window's ranked[0], but picks later skip players already taken (dedupe), so the chosen chain's DP value can exceed what its actual picks deliver until certify() recomputes
  - (opus) magic numbers: OPTION_COUNT 5, RANKED_COUNT 12, GUARANTEED_DROPS 3, PAIR_DROPS 4, EXTRA_WORK 2,000,000, ALTERNATIVE_DROPS 3
  - (opus) chains limited to the current acquisition period; budget/unknown waiver leagues excluded
  - (codex:roster-streaming-blend) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-streaming-chain-search) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-RSO-040 Client bench/dead-day tallies (DustMatrix, BenchDays)

- **Match:** Opus only; Opus RSO-001; Codex —
- **Purpose:** Counts per player/position/week how many scheduled games sit on the bench or are off-days.
- **Where:** `web/components/DraftDashboard/DustMatrix.tsx:40 (playerRows)`; `web/components/DraftDashboard/DustMatrix.tsx:58 (positionRows)`; `web/components/DraftDashboard/DustMatrix.tsx:75 (max, weekTotals)`; `web/components/DraftDashboard/DustMatrix.tsx:153 (strength)`; `web/components/RosterScheduleOptimizer/BenchDays.tsx:28 (rows)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: development, current
- **Opus view (RSO-001):**
  - Method: DustMatrix: per player-week scheduled/active/bench day counts; positions sum players (one position per player); heat = bench/max(1, max bench). BenchDays: remaining days with state off + sat (DUST), sorted by off+sat desc then active asc.
  - Inputs/units: days/games; sources: RSO/draft DUST baseline (RSO-003, DRF-013)
  - Output scale: counts; 0-1 heat; writes: —
  - Status: live — Draft dashboard DUST matrix, RSO bench days
  - Consumers: DraftDashboard (Draft Pro); RosterScheduleOptimizer page
- **Audit context:**
  - Intent (Opus): BenchDays.tsx:24 comment: days left when each lineup player doesn't count: off plus sat (DUST)
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/RosterScheduleOptimizer/BenchDays.test.tsx`; `web/e2e/dust-matrix.spec.ts`
- **Leads (not audited):**
  - (opus) DustMatrix groups by a single listed position while RSO-003 counts each eligible position
  - (opus) BenchDays mixes no-game off-days with DUST benchings in one sort key

## M-RSO-041 RSO lineup expected-points tercile tiers

- **Match:** Opus only; Opus RSO-002; Codex —
- **Purpose:** Tags each lineup cell's expected fantasy points as high/mid/low for the week.
- **Where:** `web/components/RosterScheduleOptimizer/SlotWeekGrid.tsx:228 (cutoffs)`; `web/components/RosterScheduleOptimizer/SlotWeekGrid.tsx:241 (tier)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (RSO-002):**
  - Method: Per class (skater/goalie separately), sort this week's assigned expected values; if >=3, cutoffs = [v[floor(n/3)], v[floor(2n/3)]]. tier = high if >=c2, low if <c1, else mid; mid when cut missing or c1==c2.
  - Inputs/units: fantasy points per game; sources: RSO forecast points
  - Output scale: 3-level ordinal; writes: —
  - Status: live — RSO slot grid
  - Consumers: RosterScheduleOptimizer -> ForecastPoints
- **Audit context:**
  - Intent (Opus): SlotWeekGrid.tsx:228 comment: high/mid/low thirds; goalies ranked apart
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/RosterScheduleOptimizer/SlotWeekGrid.test.tsx`
- **Leads (not audited):**
  - (opus) tiers are relative to the user's own lineup, not league-wide
  - (opus) asymmetric boundary (>=c2 high, <c1 low)

## M-RSO-042 RSO streaming itinerary override totals and goalie-minimum tradeoff

- **Match:** Opus only; Opus RSO-003; Codex —
- **Purpose:** Recomputes chain games/points when a user swaps a stream option and states the goalie-minimum cost.
- **Where:** `web/components/RosterScheduleOptimizer/StreamingItinerary.tsx:11 (totals)`; `web/components/RosterScheduleOptimizer/StreamingItinerary.tsx:33 (goalieStatus)`; `web/components/RosterScheduleOptimizer/StreamingItinerary.tsx:97 (cumulative adds/games)`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-003):**
  - Method: games += option.games - leg.games and points += option.points - leg.points for each override (null propagates); cumulative adds/games in date order. Tradeoff: compare a minimum-meeting chain with the best missing chain by AGP difference, else projected FPts difference.
  - Inputs/units: games; fantasy points; sources: lib/rosterScheduleOptimizer/streamingChain plan
  - Output scale: counts / points; writes: —
  - Status: live — RSO streaming plan
  - Consumers: RosterScheduleOptimizer page
- **Audit context:**
  - Intent (Opus): StreamingItinerary.tsx:48 comment: day-by-day streaming plan; totals show projections
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx`; `web/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx`
- **Leads (not audited):**
  - (opus) override deltas assume legs are independent (no re-run of slot matching), flagged only as 'estimated'

## M-RSO-043 Candidate shortlist heuristic

- **Match:** Opus only; Opus RSO-010; Codex —
- **Purpose:** Pick the bounded candidate set for the planner's beam search.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:1226 (shortlist)`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-010):**
  - Method: Sort by fit addedGames desc, then forecast-covered game count desc, then id; first seed one per label G, C, LW, RW, D and one per remaining date (team plays that day), then fill to limit (default 40).
  - Inputs/units: addedGames counts; forecast-covered game counts; sources: —
  - Output scale: ordered candidate list (<= 40); writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: planRoster
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/planning.test.ts`
- **Leads (not audited):**
  - (opus) no projected points in shortlist ordering - a high-points low-games player can be excluded before search

## M-RSO-044 Points comparison 5% similarity display

- **Match:** Opus only; Opus RSO-012; Codex —
- **Purpose:** Mark no-move vs plan projected totals as similar.
- **Where:** `web/components/RosterScheduleOptimizer/CategoryGains.tsx:29 (similar)`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-012):**
  - Method: denominator = max(\|before\|,\|after\|); similar if min/den >= max/den - 0.05 (or both 0).
  - Inputs/units: fantasy points; sources: —
  - Output scale: boolean similar (5% band); writes: —
  - Status: live — CategoryGains.tsx (points mode)
  - Consumers: CategoryGains UI
- **Audit context:**
  - Intent (Opus): CategoryGains.tsx:43 ('not a confidence interval or an automatic decision')
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx`
- **Leads (not audited):**
  - (opus) magic number: 5% band, explicitly not a confidence interval

## M-RSO-045 RSO planning data load and forecast source selection

- **Match:** Opus only; Opus RSO-014; Codex —
- **Purpose:** Load players, schedule, admitted forecasts (native/shared or interim FORGE bridge), participation sources, ownership, recent form and matchup weeks into one planning snapshot.
- **Where:** `web/lib/rosterScheduleData/planning.ts:74 (loadPlanningData)`; `web/lib/rosterScheduleData/planning.ts:213 (bridge fallback gate)`; `web/lib/rosterScheduleData/planning.ts:276 (forecastManifest)`; `web/lib/rosterScheduleData/planningInputs.ts:161 (36 h schedule witness)`
- **Tags (heuristic):** denominators: per team game; generation: current
- **Opus view (RSO-014):**
  - Method: Range <= 367 days; 20 s overall deadline, 8 s input stages. Admit shared game revisions when starter-board serving is on (canary game ids); if none admitted, no native baselines, source kind 'legacy' and RSO_FORGE_DAILY_BRIDGE != 'off', use the FORGE daily bridge. Manifest requiredOpportunities = sum over players of scheduled team games; forecastedOpportunities = forecast rows. Attaches ownership (<=3 days fresh), recent form (30-day window, last 10/5 played), deployment chips; later-impact scenario only when RSO_LATER_IMPACT_SCENARIO=on.
  - Inputs/units: ISO dates; ms deadlines; ownership percent 0-100; sources: roster_optimizer_team_games, yahoo_matchup_weeks, forge game revisions (read_forge_game_revisions RPC), native contribution bundles / participation catalogs, forge_runs, forge_player_projections, forge_goalie_projections, goalie_start_projections, yahoo_player_ownership_daily, yahoo_nhl_player_map_read, wgo_skater_stats, wgo_goalie_stats, lineCombinations, powerPlayCombinations
  - Output scale: snapshot object; opportunity counts; writes: —
  - Status: live — pages/api/v1/roster-schedule-optimizer/data.ts:23 and yahoo-current-data.ts:27 (forgeDailyBridge:true, consumer 'rso')
  - Consumers: pages/api/v1/roster-schedule-optimizer/data.ts; pages/api/v1/roster-schedule-optimizer/yahoo-current-data.ts; lib/integrations/yahoo/rosterPlanning.ts
- **Audit context:**
  - Intent (Opus): lib/rosterScheduleData/planning.ts:212 comment (interim RSO source TJ 2026-10-19, before native activation only); tasks/prd-roster-schedule-optimizer.md; tasks/tasks-prd-rso-consolidated-2026-10-09.md
  - External references: none suggested
  - Fixtures/test data: `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`; `web/lib/player-forecasts/rsoUsePolicy.fixtures.ts`; `web/__tests__/fixtures/consumerGameRevision.ts`; `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/__tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts`; `web/lib/integrations/yahoo/rosterPlanning.test.ts`; `web/lib/rosterScheduleData/planning.test.ts`
- **Leads (not audited):**
  - (opus) forecast source silently switches between native/shared revisions and the interim bridge depending on admission, so plan values change basis without a model change
  - (opus) requiredOpportunities counts all players' team games including non-roster catalog players

## M-RSO-046 Bridge forecast transport trimming

- **Match:** Opus only; Opus RSO-021; Codex —
- **Purpose:** Fit forecasts into byte budgets by withholding reserves then trimming later games.
- **Where:** `web/lib/rosterScheduleData/forgeDailyBridge.ts:694 (byte budget loop)`; `web/lib/rosterScheduleData/bridgeForecastWire.ts:183 (fitBridgeWire)`; `web/lib/rosterScheduleData/forgeDailyBridge.ts:28 (budgets)`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-021):**
  - Method: Wire budget 2,500,000 B, expanded 6,000,000 B; reserve rows withheld all-or-nothing; then keep earliest rows until budget; response fit by binary search on prefix length.
  - Inputs/units: bytes (UTF-8 JSON); sources: —
  - Output scale: kept row count; writes: —
  - Status: live — (interim fallback) loadPlanningData(..., forgeDailyBridge: true) from pages/api/v1/roster-schedule-optimizer/data.ts:23, yahoo-current-data.ts:27, lib/integrations/yahoo/rosterPlanning.ts:417; runs only when no native/shared forecasts are admitted and env RSO_FORGE_DAILY_BRIDGE != 'off' (web/lib/rosterScheduleData/planning.ts:213)
  - Consumers: planning data API
- **Audit context:**
  - Intent (Opus): forgeDailyBridge.ts:27-35 (byte budgets, raised 2026-10-26); bridgeForecastWire.ts:178-182
  - External references: none suggested
  - Fixtures/test data: `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
  - Tests: `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `web/lib/rosterScheduleData/forgeReservePayload.test.ts`
- **Leads (not audited):**
  - (opus) trimmed later games become schedule-only, silently changing which objective (agp vs outcome) the planner can use

## M-RSO-047 Forecast coverage accounting

- **Match:** Opus only; Opus RSO-023; Codex —
- **Purpose:** Count required vs eligible forecast opportunities and reasons for exclusions.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:329 (competitorCoverage)`; `web/lib/rosterScheduleOptimizer/planning.ts:29 (sanitizeForecastInputs)`; `web/lib/rosterScheduleData/planning.ts:276 (forecastManifest requiredOpportunities)`
- **Tags (heuristic):** denominators: per team game; generation: current
- **Opus view (RSO-023):**
  - Method: Per (player, game, target) required count; assignment/totals/comparison eligible counts; conflicting duplicate forecasts (different JSON for same player-game) excluded; reasons (stale_source, missing_target, use_not_approved, eligibility_unverified...). requiredOpportunities = sum over players of scheduled team games.
  - Inputs/units: player-game-target identities; sources: forecast manifests
  - Output scale: counts and reason lists; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves); ForecastEvidence.tsx
  - Consumers: recommendation coverage; futureImpact evaluateArm; ForecastEvidence.tsx
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (limitations text planning.ts:281-282 in rosterScheduleData)
  - External references: none suggested
  - Fixtures/test data: `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`; `web/lib/player-forecasts/rsoUsePolicy.fixtures.ts`; `web/__tests__/fixtures/consumerGameRevision.ts`
  - Tests: `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`; `web/lib/rosterScheduleOptimizer/planning.test.ts`

## M-RSO-048 Unknown-quality contamination and conditional ability tie-break

- **Match:** Opus only; Opus RSO-035; Codex —
- **Purpose:** When any competitor lacks a forecast, fall back to schedule capacity for the whole connected slot component, with a small conditional-ability tie-break.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:430 (assign: unknown components)`; `web/lib/rosterScheduleOptimizer/planning.ts:465 (conditional tie scale)`
- **Tags (heuristic):** conditionality: conditional; denominators: per appearance; generation: current
- **Opus view (RSO-035):**
  - Method: Unknown set grows over the connected component of shared eligible slots. Points mode only: if every skater in a component has finite conditional stats, tie = conditionalPoints / (1 + sum\|conditionalPoints\|) x 0.5, added to capacity weight (cannot overturn a game-count difference).
  - Inputs/units: fantasy points (conditional per appearance); sources: FORGE forecasts
  - Output scale: tie-break bonus in (-0.5, 0.5); writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: assign()
- **Audit context:**
  - Intent (Opus): planning.ts:427-429 comment (unknown quality contaminates the whole competing slot component); limitation text :467
  - External references: none suggested
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/planning.test.ts`
- **Leads (not audited):**
  - (opus) magic number: 0.5 scaling; goalies never get a conditional tie-break
  - (opus) one missing forecast anywhere in a component (incl. UTIL) turns all its start/sit into capacity-only

## M-RSO-049 Outcome lineup local-search refinement

- **Match:** Opus only; Opus RSO-036; Codex —
- **Purpose:** Bounded neighbourhood search over complete lineups for category leagues or points goalie coverage.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:505 (refineOutcomeLineup)`; `web/lib/rosterScheduleOptimizer/planning.ts:596 (search loop)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (RSO-036):**
  - Method: Score: stats = realized + assigned stats; points -> (coverage=min(target, credited+sum min(1,probs)), value = sum weight x stat); categories -> per-category values + coverage + capacity. Compare points by coverage then value; categories by coverage, then capacity (agp), then dominance. Neighbours: swap/empty one (date,slot) (or weekly window slot). Depth <= 3, <= 100 evaluations, frontier top 6 (points sorted; categories non-dominated set).
  - Inputs/units: stat counts per game (goals, assists, shots, hits, blocks, PIM, saves...), weights = league fantasy points per stat unit; start probabilities 0-1; sources: —
  - Output scale: assignment set; score fantasy points / category vector; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: evaluatePreparedPlan
- **Audit context:**
  - Intent (Opus): planning.ts:504 ('Compare complete category or points-goalie lineups; local moves remain bounded'); limitation :613-615
  - External references: Local search / beam vs exact ILP
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`
- **Leads (not audited):**
  - (opus) magic numbers: depth 3, 100 evaluations, beam 6 - result explicitly not proven optimal
  - (opus) points mode only refines goalie G slots

## M-RSO-050 Started-game lock inference

- **Match:** Opus only; Opus RSO-037; Codex —
- **Purpose:** Hold slots for players whose game already started today (provider locks, or inferred pre-puck-drop lineup).
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:686 (started games block)`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-037):**
  - Method: If any game today started: slot = provider lock, else re-run assign() on pre-start plays to infer; started rows held as locked and not counted as remaining games; missing locks set invalidLocks and provisional limitation.
  - Inputs/units: ISO instants (startsAt vs asOf); sources: Yahoo lineup locks
  - Output scale: locked assignment rows; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: evaluatePreparedPlan
- **Audit context:**
  - Intent (Opus): planning.ts:682-685 comment (daily providers lock at game time)
  - External references: Yahoo daily lineup lock at puck drop
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`

## M-RSO-051 Weekly lineup window aggregation

- **Match:** Opus only; Opus RSO-038; Codex —
- **Purpose:** For weekly-lock leagues, aggregate each rostered player's window games into one play for a single window assignment.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:761 (weekly branch in evaluatePreparedPlan)`; `web/lib/rosterScheduleOptimizer/planningDates.ts:4 (lineupPeriodAtDate)`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-038):**
  - Method: Roster at lockAt; per player gamesCount = window games, stats summed over approved assignment stats; forecast nulled if any game missing. assign() once per window (weight gamesCount x agpBonus + value); slots repeated on every window date. Conflicting locks invalidate.
  - Inputs/units: stat counts summed over window games; ISO lockAt; sources: Yahoo league lineup periods / manager overrides
  - Output scale: per-window slot assignment; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves) (weekly-lineup leagues only)
  - Consumers: evaluatePreparedPlan; refineOutcomeLineup weekly neighbours
- **Audit context:**
  - Intent (Opus): docs/roster-schedule-optimizer.md:130 lists 'verified weekly-lock assignment model' as future work; planning.ts:758-759 comment
  - External references: Weekly-lineup leagues: maximise weekly games x value per slot
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/planning.test.ts`

## M-RSO-052 Schedule preparation and Yahoo week mapping

- **Match:** Opus only; Opus RSO-041; Codex —
- **Purpose:** Deduplicate team-games, filter playable statuses, map dates to Yahoo matchup weeks.
- **Where:** `web/lib/rosterScheduleOptimizer/optimizer.ts:51 (prepareTeamSchedule)`; `web/lib/rosterScheduleOptimizer/weeks.ts:17 (mapDateToYahooWeek)`; `web/lib/rosterScheduleOptimizer/weeks.ts:3 (isIsoDate)`
- **Tags (heuristic):** generation: development, current
- **Opus view (RSO-041):**
  - Method: Statuses scheduled/live/final kept; one game per team-date (duplicates ignored with warning); date maps to a week when exactly one week has start<=date<=end (inclusive both ends) for the game key; overlap or none -> error and excluded.
  - Inputs/units: ISO dates YYYY-MM-DD; Yahoo week numbers; sources: roster_optimizer_team_games, yahoo_matchup_weeks
  - Output scale: games grouped by team/date; week integer; writes: —
  - Status: live — lib/draft-pro/dust.ts called by pages/api/v1/draft-pro/dust.ts and lib/draftDashboard/draftProDustPresentation.ts; docs/roster-schedule-optimizer.md:83 says the Draft Dashboard route sits behind a maintenance notice
  - Consumers: evaluateRosterSchedule; draft-pro/dust.ts
- **Audit context:**
  - Intent (Opus): docs/roster-schedule-optimizer.md '## Matchup-week mapping' (47-55): Yahoo week boundaries inclusive
  - External references: Yahoo matchup week boundaries (inclusive)
  - Fixtures/test data: `web/e2e/draft-pro-fixtures.ts`; `web/e2e/roster-schedule-optimizer-fixtures.ts`
  - Tests: `web/lib/draft-pro/dust.test.ts`; `web/lib/rosterScheduleOptimizer/optimizer.test.ts`
- **Leads (not audited):**
  - (opus) hard-coded constant: DEFAULT_YAHOO_GAME_KEY='477' and week range 1-30 in web/lib/rosterScheduleData/constants.ts:1-6 (season-specific)

## M-RSO-053 Latest equivalent action time

- **Match:** Opus only; Opus RSO-042; Codex —
- **Purpose:** Time a 'due now' move at the latest instant with the same outcome.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:1246 (latestEquivalentActionAt)`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-042):**
  - Method: min(all boundaries >= asOf) - 60,000 ms; null if not after asOf.
  - Inputs/units: ISO instants (ms); sources: —
  - Output scale: ISO instant; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: extensions; streamingChain timing
- **Audit context:**
  - Intent (Opus): planning.ts:1241-1245 docstring (time a due-now move at the latest instant with the same outcome)
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) magic number: 1-minute buffer before puck drop
  - (opus) no direct test reference for latestEquivalentActionAt (rg)

## M-RSO-054 Schedule freshness witness and warning thresholds

- **Match:** Opus only; Opus RSO-043; Codex —
- **Purpose:** Gate planning on schedule observation age.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:625 (SCHEDULE_WITNESS_TTL_MS)`; `web/lib/rosterScheduleOptimizer/planning.ts:629 (scheduleAdmissionProblem)`; `web/components/RosterScheduleOptimizer/canonicalSchedule.ts:53 (36 h)`; `web/lib/rosterScheduleData/planningInputs.ts:161 (36 h)`; `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx:104 (scheduleWarning)`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-043):**
  - Method: Schedule witness expires 36 h after oldest fetch; observation after planning time blocks. UI warning when receipt older than 6 h, or 2 h within 0-120 min before a covered game.
  - Inputs/units: ISO instants; hours; sources: roster_optimizer_team_games
  - Output scale: admission problem text / warning; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: evaluatePreparedPlan; candidatePlanMetrics; swapCategoryBreakdown
- **Audit context:**
  - Intent (Opus): planning.ts:624-628 docstrings; RosterScheduleOptimizer.tsx:1160 tooltip (provisional thresholds)
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/roster-schedule-optimizer/schedule.test.ts`; `web/components/RosterScheduleOptimizer/canonicalSchedule.test.ts`
- **Leads (not audited):**
  - (opus) magic numbers: 36 h TTL, 6 h / 2 h warning

## M-RSO-055 Period, lineup-window and timezone boundary math

- **Match:** Opus only; Opus RSO-044; Codex —
- **Purpose:** League-local midnights, lineup windows, DST-safe period boundaries, weekly window completeness.
- **Where:** `web/lib/rosterScheduleOptimizer/planningDates.ts:15 (zonedMidnight)`; `web/lib/rosterScheduleOptimizer/planningDates.ts:9 (localDate)`; `web/lib/rosterScheduleOptimizer/periodBoundaries.ts:14 (resolvePeriodBoundary)`; `web/lib/rosterScheduleOptimizer/providerRules.ts:12 (completeWeeklyWindows)`; `web/lib/rosterScheduleOptimizer/providerRules.ts:34 (supplementProviderRules)`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-044):**
  - Method: zonedMidnight: 3 fixed-point passes correcting UTC guess by displayed local time. resolvePeriodBoundary: probe offsets at -2..+2 days; exactly one round-tripping instant else DST gap/fold error. Weekly windows complete if <=100, non-overlapping, lock<=end, cover every local day of range <=366 days. Manager overrides fill only missing provider values; conflicts reported; revision hash 31-multiplier string hash.
  - Inputs/units: ISO dates/instants; IANA time zones; sources: Yahoo league settings, manager rule overrides
  - Output scale: ISO instants / window ids; writes: —
  - Status: live — planner, timeline, AcquisitionPeriodTimes.tsx, supplementProviderRules in RosterScheduleOptimizer.tsx
  - Consumers: planning.ts; streamingChain; planningTimeline; AcquisitionPeriodTimes.tsx
- **Audit context:**
  - Intent (Opus): periodBoundaries.ts:3, 13; providerRules.ts:6-7 (TJ D6), 33
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/RosterScheduleOptimizer/AcquisitionPeriodTimes.test.tsx`; `web/lib/rosterScheduleOptimizer/periodBoundaries.test.ts`; `web/lib/rosterScheduleOptimizer/providerRules.test.ts`

## M-RSO-056 Form label and deployment chips

- **Match:** Opus only; Opus RSO-046; Codex —
- **Purpose:** Hot/cold labels and line/PP-unit chips for players.
- **Where:** `web/lib/rosterScheduleData/planning.ts:381 (form label)`; `web/lib/rosterScheduleData/planning.ts:403 (deployment line)`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-046):**
  - Method: Hot = last-3 points >= 6; cold = >=5 samples and last-5 points == 0. Line = floor(index/3)+1 for first 12 forwards (L1-L4), D pair floor(index/2)+1 for first 6 D; PP unit 1/2 only; stale if charted game older than 7 days or player's last game later than charted game; read last 14 days.
  - Inputs/units: points (counts) last 3/5 games; lineup array positions; sources: wgo_skater_stats, lineCombinations, powerPlayCombinations, games
  - Output scale: label enum; L1-L4 / D1-D3; PP1/PP2; writes: —
  - Status: live — lib/rosterScheduleData/planning.ts (loadPlanningData, unless skipRecentForm)
  - Consumers: candidate cards / roster rows
- **Audit context:**
  - Intent (Opus): lib/rosterScheduleData/planning.ts:50-52, 400-401 comments; evidence text :385
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rosterScheduleData/planning.test.ts`
- **Leads (not audited):**
  - (opus) magic numbers: hot 6 points in 3 games, cold 0 in 5, 14/7-day windows
  - (opus) line inferred from array position assumes lineCombinations ordered by line

## M-RSO-057 Intent reconciliation (refresh revalidation and allowance re-spend)

- **Match:** Opus only; Opus RSO-047; Codex —
- **Purpose:** Re-check a saved plan against refreshed inputs and propose removing invalid steps.
- **Where:** `web/lib/rosterScheduleOptimizer/reconciliation.ts:5 (reconcileIntent)`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-047):**
  - Method: Invalidate steps whose time passed, player unavailable/rostered, drop not allowed, no period, effective < earliest; cascade to dependents. Re-spend: per period cumulative acquisitionCost must be <= remaining; reserve capacity counted. Then iteratively remove the first step making the timeline illegal. Goalie evidence change detected by JSON diff of start probabilities.
  - Inputs/units: ISO instants; acquisition counts; sources: —
  - Output scale: issue list; suggested steps; writes: —
  - Status: live — RosterScheduleOptimizer.tsx calls reconcileIntent
  - Consumers: RosterScheduleOptimizer.tsx
- **Audit context:**
  - Intent (Opus): reconciliation.ts:4 ('Recheck selected intent against new authoritative inputs; repairs require explicit acceptance')
  - External references: none suggested
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`; `web/lib/rosterScheduleOptimizer/reconciliation.test.ts`

## M-RSO-058 Ownership freshness

- **Match:** Opus only; Opus RSO-048; Codex —
- **Purpose:** Attach Yahoo ownership % only when fresh.
- **Where:** `web/lib/rosterScheduleData/planning.ts:54 (ownershipPct)`; `web/lib/rosterScheduleData/planning.ts:317 (fresh check)`; `web/lib/rosterScheduleOptimizer/retention.ts:17 (knownOwnership)`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (RSO-048):**
  - Method: 0-100 numeric only; unique yahoo->nhl mapping; fresh if observed within 3 days (ownership), else stored as stale evidence (display only).
  - Inputs/units: ownership percent 0-100; ISO dates; sources: yahoo_player_ownership_daily, yahoo_nhl_player_map_read
  - Output scale: percent 0-100 or null; writes: —
  - Status: live — loadPlanningData (unless skipOwnership)
  - Consumers: drop tie-breaks; retention caution
- **Audit context:**
  - Intent (Opus): retention.ts:15-16; lib/rosterScheduleData/planning.ts:313-314 (fresh <= 3 days)
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rosterScheduleData/planning.test.ts`; `web/lib/rosterScheduleOptimizer/retention.test.ts`

## M-RSO-059 Team schedule context (schedule score, off-nights)

- **Match:** Opus only; Opus RSO-054; Codex —
- **Purpose:** Top-5 teams by Game Grid schedule score for the range with off-night markers.
- **Where:** `web/components/RosterScheduleOptimizer/TeamScheduleContext.tsx:18 (teamScheduleContext)`; `web/components/RosterScheduleOptimizer/TeamScheduleContext.tsx:65 (offNight)`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-054):**
  - Method: Consumer note only: shows top-5 teams by GameGrid weekScore and GameGrid off-night flags for the selected dates; the RSO planner does not use these numbers. Calculation is owned by the GameGrid slice.
  - Inputs/units: —; sources: NHL schedule API via /api canonical schedule
  - Output scale: —; writes: —
  - Status: live — consumer note only: TeamScheduleContext.tsx renders GameGrid weekScore/off-nights (GameGrid owned by another slice)
  - Consumers: RosterScheduleOptimizer page context strip
- **Audit context:**
  - Intent (Opus): TeamScheduleContext.tsx:80 tooltip ('team schedule context, not net roster fit')
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/RosterScheduleOptimizer/TeamScheduleContext.test.tsx`

## M-RSO-060 Streaming chain certification and ranking

- **Match:** Opus only; Opus RSO-059; Codex —
- **Purpose:** Re-evaluate proposed chains with the plan evaluator and order them.
- **Where:** `web/lib/rosterScheduleOptimizer/streamingChain.ts:338 (certify)`; `web/lib/rosterScheduleOptimizer/streamingChain.ts:363 (objectiveOrder)`; `web/lib/rosterScheduleOptimizer/streamingChain.ts:452 (streamingChainSteps)`
- **Tags (heuristic):** generation: current
- **Opus view (RSO-059):**
  - Method: netGames = evaluation.activeGames - baseline.activeGames; netPoints = projectedValue diff (comparable only); netScore = blended score over remaining assignments minus baseline. Order: goalie-minimum met first (when targeted), then pointsFirst: net (score else points) with 1e-9 tolerance, then netGames, then points, then fewer adds. Kept if netGames>0, or meets goalie need, or pointsFirst and points>1e-9.
  - Inputs/units: active games; fantasy points; sources: —
  - Output scale: certified chain metrics; ordering; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: StreamingItinerary.tsx
- **Audit context:**
  - Intent (Opus): streamingChain.ts:14-15 ('every returned chain is certified by the plan evaluator'); :36-39 VORP S1/S4 alternatives
  - External references: none suggested
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/streamingChain.test.ts`
- **Leads (not audited):**
  - (opus) ranking uses blended netScore (incl. last-10 form) in preference to evaluator netPoints, so shown 'points' and ranking basis differ

