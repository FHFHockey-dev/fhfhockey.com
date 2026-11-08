# 2026-10-26 · Claude · RSO-MANUAL FR9/FR10 category acceptance packet

## Scope
New `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts` only: daily H2H category league fixtures through
evaluatePlan, planRoster, candidatePlanMetrics and reconcileIntent. FR9 (banked + future totals, pooled ratios, opponent
win/loss/tie, unknowns without probability claims, no scalar blend) and FR10 (credited/confirmed/projected goalie minimum,
cover vs accept risk, unknown semantics, forfeiture path, starts ≠ appearances). Independent oracle. No planner fixes.
Receipt: tasks/artifacts/astra-rso-handoff-2026-10-26/slices/FR9-FR10/.

## Where
octoberBranch @ HEAD (see receipt). No commit.

## State
- [start] Mapped categoryValue / opponentStats / categoryResults / compareCategoryEvaluations /
  categoryGoalieCoverageTarget / goalie minimum block in planning.ts; e2e oracle pattern.

- [done] Suite: 13 tests (11 + 2 it.fails: FR9-D1 opponent remaining component missing → treated as 0, SV% 1.447;
  FR9-D2 category projectedValue = wins−losses scalar, -4). UTC ×2 and New York ×2 green; RSO lib NY 627/627;
  eslint 0; scoped tsc 0. Receipt slices/FR9-FR10/RECEIPT.md (sha256 a05478a4…).

## Next
Orchestrator commits; planner owner decides FR9-D1/D2. Retire diary after commit.

## Gotchas
- Category lineups use a native-unit partial order: sitting a goalie only happens when it is strictly better in every
  category (a goalie with projected wins makes sitting a tradeoff, so the planner keeps him).

## FR9-D1/D2 fix (ticket after 6c36c8e8c)
- planning.ts: opponentStats unions realized/remaining keys (missing either side → null); category mode keeps internal
  matchupKnown for comparisonEligible and reports projectedValue null; planRoster drop-recommendation limitation keyed
  on comparisonEligible in category mode. Leased tests flipped/updated (pins → it; planning.test.ts:1371). 215/215 leased green.
- Consumer audit: planning.ts internal (comparisonEligible, planRoster limitation) changed; compareEvaluations/safeAlternative/
  orderStates already category-branch; benchDecisions/planComparison gated on recommendation.eligible (never in categories);
  CategoryGains/healthyReserves/lineupGaps/candidatePlanMetrics netPoints are points-only.
- Lease extended by orchestrator; fixtures/assertions updated in planningReproducibility.test.ts and CategoryGains.test.tsx
  (+ planning.test.ts:1564 explicit 0). Suites UTC+NY 3,226/3,226; eslint 0; whole tsc 0 under lock (waited for another
  lane's hold). Receipt slices/FR9-FR10/RECEIPT-FIX.md. Next: orchestrator commits; rso-flake gets the opponent-form UX note.
- (resolved) BLOCKED: 6 failures in out-of-lease tests that pin the old behaviour (planningReproducibility.test.ts:112/141,
  CategoryGains.test.tsx:65/160 use `remaining: {}` or expect category projectedValue). Asked orchestrator for a lease
  extension (message 023a4759…). Full suites, tsc and receipt pending the answer.
