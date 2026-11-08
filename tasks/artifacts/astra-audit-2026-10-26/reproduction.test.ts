import {beforeEach,afterEach,describe,expect,it,vi} from '/Users/tim/Code/fhfhockey.com/web/node_modules/vitest/dist/index.js';
import * as rsoPolicy from '/Users/tim/Code/fhfhockey.com/web/lib/player-forecasts/rsoUsePolicy';
import {candidatePlanMetrics} from '/Users/tim/Code/fhfhockey.com/web/lib/rosterScheduleOptimizer/candidatePlanMetrics';
import {defaultWorkspace,defaultIntent} from '/Users/tim/Code/fhfhockey.com/web/lib/rosterScheduleOptimizer/workspace';
import {evaluatePlan,gameForecastPoints} from '/Users/tim/Code/fhfhockey.com/web/lib/rosterScheduleOptimizer/planning';
import type {GameForecast,PlanningSnapshot} from '/Users/tim/Code/fhfhockey.com/web/lib/rosterScheduleOptimizer/planningTypes';
const fixtureScope = { component: "fictional-candidates", modelMode: "synthetic", codeVersion: "fixture",
  configurationHash: "a".repeat(64), artifactHash: "b".repeat(64), targetKey: "SHOTS_ON_GOAL", horizonGames: 1,
  conditioning: "synthetic-unconditional", participationLineage: "synthetic-only" };
const fixturePolicy: rsoPolicy.RsoUsePolicy = { version: "rso-target-use-v1", revision: "fictional-candidate-reviews",
  revokedReviewIds: [], reviews: [{ id: "fictional-GOALS", binding: fixtureScope, reviewedAt: "2026-09-01T00:00:00Z",
    expiresAt: "2100-01-01T00:00:00Z", inputCutoffFrom: "2026-09-01T00:00:00Z", inputCutoffUntil: "2100-01-01T00:00:00Z",
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
    prospectiveEvidenceRef: "fictional-evidence", ownerApprovalRef: "fictional-approval" }] };
beforeEach(() => vi.spyOn(rsoPolicy, "currentRsoUsePolicy").mockReturnValue(fixturePolicy));

function fixture(): PlanningSnapshot {
  const workspace = defaultWorkspace(new Date("2026-10-04T12:00:00Z"));
  const players = ["a", "b", "c"].map((id, index) => ({ id, nhlId: index + 1, nhlTeamId: index + 1,
    rosterRevision: `roster-${id}`, name: id, teamAbbreviation: id.toUpperCase(), eligiblePositions: ["C"],
    eligibilityVerified: true, playerClass: "skater" as const, availability: id === "c" ? "free_agent" as const : "rostered" as const,
    canDrop: true, ownership: null, holdValue: null, reserveEligibility: [] }));
  const games = players.map(row => { const date = row.id === "c" ? "2026-10-05" : "2026-10-06";
    return { id: row.id, date, startsAt: `${date}T20:00:00Z`, scheduleRevision: `schedule-${row.id}`,
      teamAbbreviation: row.teamAbbreviation, opponent: "X", home: true, status: "scheduled" as const }; });
  const snapshot: PlanningSnapshot = { id: "net-candidate-fixture", context: { ...workspace.context, startDate: "2026-10-05", endDate: "2026-10-06", timeZone: "UTC" },
    players, roster: [{ playerId: "a", position: "active" }, { playerId: "b", position: "bench" }], games, forecasts: [],
    rules: { ...workspace.rules, rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "week", start: "2026-10-04T00:00:00Z", end: "2026-10-08T00:00:00Z", remaining: 1, source: "manager" }],
      scoring: { mode: "points", weights: { SHOTS_ON_GOAL: 1 }, categories: [] } }, lockedAssignments: [], realized: {}, opponent: null,
    evidence: { schedule: { source: "Local fixture", asOf: workspace.context.asOf, seasonId: workspace.context.seasonId, completeness: "complete", limitations: [] } } };
  snapshot.forecasts = players.map(row => {
    const game = games.find(game => game.id === row.id)!;
    return { playerId: row.id, gameId: game.id, stats: { SHOTS_ON_GOAL: row.id === "a" ? 10 : row.id === "b" ? 1 : 2 },
      conditioning: "unconditional", sourceKind: "detailed", sourceWatermark: "fixture-only", cutoffAt: snapshot.context.asOf,
      issuedAt: snapshot.context.asOf, expiresAt: game.startsAt, revisionId: `revision-${row.id}`, modelVersion: "fixture",
      startProbability: null, confirmedStart: false, allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false }, limitations: [],
      rsoTargetBindings: { SHOTS_ON_GOAL: { ...fixtureScope, cutoffAt: snapshot.context.asOf } },
      issuedContext: { version: "forge-issued-context-v1", playerId: row.id, gameId: game.id, nhlPlayerId: row.nhlId, teamId: row.nhlTeamId,
        seasonId: snapshot.context.seasonId, scheduledAt: game.startsAt, scheduleRevision: game.scheduleRevision, rosterRevision: row.rosterRevision,
        observedAt: snapshot.context.asOf, scheduleSourceUpdatedAt: snapshot.context.asOf, scheduleFetchedAt: snapshot.context.asOf,
        identityUpdatedAt: snapshot.context.asOf, membershipCreatedAt: ["2026-09-01T00:00:00Z"] } } as GameForecast;
  });
  return snapshot;
}

afterEach(()=>vi.restoreAllMocks());
describe('Independent audit reproductions',()=>{
 it('control: full fictional permissions produce a comparable legal baseline',()=>{const s=fixture(); const p=evaluatePlan(s,defaultIntent(),'agp',[],false); expect(p.legal).toBe(true);expect(p.comparisonEligible).toBe(true);expect(p.projectedValue).toBe(10);});
 it('approved SOG totals/comparison without assignment cannot support current plan comparison',()=>{const s=fixture();const policy=structuredClone(fixturePolicy);policy.reviews[0].allowedUses.assignment=false;vi.spyOn(rsoPolicy,'currentRsoUsePolicy').mockReturnValue(policy);const p=evaluatePlan(s,defaultIntent(),'agp',[],false);expect(p.legal).toBe(true);expect(p.activeGames).toBe(1);expect(p.comparisonEligible).toBe(false);expect(p.projectedValue).toBeNull();console.log('SOG_PERMISSION_REPRO',JSON.stringify({legal:p.legal,activeGames:p.activeGames,comparisonEligible:p.comparisonEligible,projectedValue:p.projectedValue,unresolved:p.unresolvedQuality}));});
 it('one revision-bound target review does not admit the next revision of the same producer',()=>{const binding={...fixtureScope,participationLineage:'revision-one:participation',cutoffAt:'2026-10-04T12:00:00Z'};const policy=structuredClone(fixturePolicy);policy.reviews[0].binding={...fixtureScope,participationLineage:'revision-one:participation'};expect(rsoPolicy.resolveRsoTargetUse(binding,'2026-10-04T12:00:00Z',policy).allowedUses.totals).toBe(true);expect(rsoPolicy.resolveRsoTargetUse({...binding,participationLineage:'revision-two:participation'},'2026-10-04T12:00:00Z',policy).allowedUses.totals).toBe(false);});
});
