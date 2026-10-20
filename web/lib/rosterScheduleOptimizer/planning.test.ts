import { describe, expect, it } from "vitest";
import { candidateAcquisitionSteps, candidateMetrics, candidateActivePoints, candidateHorizonPoints, evaluatePlan, planRoster, scheduleFits, swapCategoryBreakdown } from "./planning";
import { comparePlanSensitivity } from "../player-forecasts/planComparison";
import { snapshotSchema } from "../in-season/workspaceSchema";
import { resolvePlanningContributions } from "../player-forecasts/planningContributions";
import { explainBenchDecisions } from "./benchDecisions";
import { candidatePlanForSort, candidatePlanMetrics, ownershipBrokeTie } from "./candidatePlanMetrics";
import { lineupGapReport } from "./lineupGaps";
import { acquisitionEffectiveAt, buildTimeline } from "./planningTimeline";
import type { GameForecast, PlanIntent, PlanningPlayer, PlanningSnapshot } from "./planningTypes";

const fixtureId = (value: string) => [...value].reduce((id, char) => (id * 31 + char.charCodeAt(0)) % 100000000, 1) + 1;
const player = (id: string, team: string, availability: PlanningPlayer["availability"] = "rostered"): PlanningPlayer => ({
  id, nhlId: fixtureId(id), nhlTeamId: fixtureId(team), rosterRevision: `roster-${id}-${team}`,
  name: id, teamAbbreviation: team, eligiblePositions: ["C"], playerClass: "skater",
  availability, eligibilityVerified: true, ownership: null, canDrop: true, holdValue: null, reserveEligibility: [],
});
const intent: PlanIntent = { revision: 3, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 5 };
function issuedForecast(data: PlanningSnapshot, playerId: string, gameId: string, overrides: Partial<GameForecast> = {}): GameForecast {
  const member = data.players.find(row => row.id === playerId)!;
  const game = data.games.find(row => row.id === gameId && row.teamAbbreviation === member.teamAbbreviation)!;
  return { playerId, gameId, stats: { pts: playerId === "a" ? 1 : 2 }, conditioning: "unconditional",
    sourceKind: "detailed", sourceWatermark: "fixture-inputs", cutoffAt: "2026-10-04T00:00:00Z",
    issuedAt: "2026-10-04T00:00:00Z", expiresAt: game.startsAt!, modelVersion: "fixture-v1", revisionId: "r",
    issuedContext: { version: "forge-issued-context-v1", playerId, gameId, nhlPlayerId: member.nhlId!,
      teamId: member.nhlTeamId!, seasonId: data.context.seasonId, scheduledAt: game.startsAt!,
      scheduleRevision: game.scheduleRevision!, rosterRevision: member.rosterRevision!, observedAt: "2026-10-04T00:00:00Z",
      scheduleSourceUpdatedAt: "2026-10-04T00:00:00Z", scheduleFetchedAt: "2026-10-04T00:00:00Z",
      identityUpdatedAt: "2026-10-04T00:00:00Z", membershipCreatedAt: ["2026-09-01T00:00:00Z"] },
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
    startProbability: null, confirmedStart: false, limitations: [], ...overrides };
}
function snapshot(): PlanningSnapshot {
  const players = [player("a", "A"), player("b", "B"), player("c", "C", "free_agent")];
  const games = ["2026-10-05", "2026-10-06"].flatMap((date, index) => ["A", "B", "C"].map(team => ({
    id: `${team}${index}`, scheduleRevision: `schedule-${team}${index}`, date, startsAt: `${date}T20:00:00Z`, teamAbbreviation: team, opponent: "X", home: true, status: "scheduled" as const,
  })));
  const data: PlanningSnapshot = {
    id: "snap", context: { provider: "manual", seasonId: 20262027, leagueId: "l", teamId: "t", startDate: "2026-10-05", endDate: "2026-10-06", timeZone: "UTC", asOf: "2026-10-04T00:00:00Z" },
    players, roster: [{ playerId: "a", position: "active" }, { playerId: "b", position: "bench" }], games,
    forecasts: [],
    rules: { lineupMode: "daily", rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "p", start: "2026-10-04T00:00:00Z", end: "2026-10-12T00:00:00Z", remaining: 2, source: "manager" }],
      scoring: { mode: "points", weights: { pts: 1 }, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] },
    lockedAssignments: [], realized: { pts: 0 }, opponent: null, evidence: { schedule: {
      source: "synthetic complete schedule", asOf: "2026-10-04T00:00:00Z", seasonId: 20262027,
      completeness: "complete", limitations: [],
    } },
  };
  data.forecasts = games.flatMap(game => players.filter(item => item.teamAbbreviation === game.teamAbbreviation)
    .map(item => issuedForecast(data, item.id, game.id)));
  return data;
}

describe("planning engine", () => {
  describe("hypothetical schedule-only full-roster swaps", () => {
    function scheduleOnlySwap() {
      const data = snapshot();
      data.players = data.players.filter(row => row.id !== "b");
      data.roster = [{ playerId: "a", position: "active" }];
      data.rules.rosterSlots = { C: 1 };
      data.games = data.games.filter(game => game.teamAbbreviation === "C" || game.id === "A0");
      data.forecasts = [];
      data.players.find(row => row.id === "c")!.availability = "manager_available";
      return data;
    }
    const options = { maxSteps: 1, maxCandidates: 1, maxEvaluations: 100 };
    it("returns a legal AGP swap with unknown points as an explicitly hypothetical schedule comparison", () => {
      const data = scheduleOnlySwap(), before = JSON.stringify(data);
      const result = planRoster(data, intent, options);
      const swap = result.alternatives.find(plan => plan.objective === "agp" && plan.steps.some(step => step.dropPlayerId === "a"));
      expect(result.noMoveAgp.activeGames).toBe(1);
      expect(swap).toMatchObject({ legal: true, budgetVerified: true, activeGames: 2, projectedValue: null,
        comparisonEligible: false, recommendation: { eligible: false, mode: "schedule_capacity" } });
      expect(swap?.limitations).toContain("Hypothetical schedule comparison using supplied availability and drop permissions; net fantasy points and drop cost are unknown.");
      expect(swap?.limitations).toContain("Dropping a: 1 scheduled active games from the no-move lineup are absent in this plan; fantasy-point cost is unknown.");
      expect(JSON.stringify(data)).toBe(before);
    });
    it.each(["protected", "cannot_drop", "unavailable", "excluded", "timing", "budget", "owned_team", "candidate_team", "schedule"])("preserves %s gates with missing points", kind => {
      const data = scheduleOnlySwap(), selectedIntent = structuredClone(intent);
      if (kind === "protected") selectedIntent.protectedPlayerIds = ["a"];
      if (kind === "cannot_drop") data.players[0].canDrop = false;
      if (kind === "unavailable") data.players[1].availability = "unknown";
      if (kind === "excluded") selectedIntent.excludedPlayerIds = ["c"];
      if (kind === "timing") data.rules.acquisitionTiming = "unknown";
      if (kind === "budget") data.rules.periods[0].remaining = null;
      if (kind === "owned_team") data.players[0].teamAbbreviation = null;
      if (kind === "candidate_team") data.players[1].teamAbbreviation = null;
      if (kind === "schedule") data.evidence.schedule!.completeness = "partial";
      expect(planRoster(data, selectedIntent, options).alternatives.every(plan => !plan.steps.length)).toBe(true);
    });
    it("still excludes a scheduled-game gain with a known points loss", () => {
      const data = scheduleOnlySwap();
      // Only the first date permits an acquisition; a delayed swap would keep
      // the10point owned game and would correctly be a different improvement.
      data.rules.periods[0].end = "2026-10-06T00:00:00Z";
      data.forecasts = data.games.map(game => issuedForecast(data, game.teamAbbreviation === "A" ? "a" : "c", game.id,
        { stats: { pts: game.teamAbbreviation === "A" ? 10 : 1 } }));
      expect(planRoster(data, intent, options).alternatives.every(plan => !plan.steps.length)).toBe(true);
    });
  });
  describe("crowded daily acceptance checkpoint", () => {
    function crowdedDay(): PlanningSnapshot {
      const data = snapshot();
      data.context.endDate = data.context.startDate;
      data.players = [
        { ...player("a", "A"), eligiblePositions: ["LW", "RW"] },
        { ...player("b", "B"), eligiblePositions: ["LW"] },
        { ...player("d", "D"), eligiblePositions: ["RW"] },
        { ...player("e", "E"), eligiblePositions: ["RW"] },
        { ...player("f", "F", "free_agent"), eligiblePositions: ["RW"] },
      ];
      data.roster = data.players.filter(row => row.id !== "f").map(row => ({ playerId: row.id, position: "bench" }));
      data.rules.rosterSlots = { LW: 1, RW: 1, BN: 2 };
      data.games = data.players.map(row => ({ ...data.games[0], id: row.id,
        teamAbbreviation: row.teamAbbreviation!, scheduleRevision: `schedule-${row.id}` }));
      const values: Record<string, number> = { a: 8, b: 7, d: 6, e: 2, f: 100 };
      data.forecasts = data.players.map(row => issuedForecast(data, row.id, row.id, { stats: { pts: values[row.id] } }));
      data.realized = { pts: 4 };
      return data;
    }

    it("reassigns the flexible player to maximize supported value without exceeding legal capacity", () => {
      const data = crowdedDay();
      const original = JSON.stringify(data);
      const selected = evaluatePlan(data, intent, "outcome");
      expect(selected).toMatchObject({ legal: true, activeGames: 2, benchGames: 2, assignmentValue: 15,
        projectedValue: 19, comparisonEligible: true, recommendation: { eligible: true } });
      expect(selected.assignments.map(row => [row.playerId, row.slotId]).sort()).toEqual([["a", "RW#1"], ["b", "LW#1"]]);
      expect(selected.recommendation?.exclusions?.map(row => row.playerId).sort()).toEqual(["d", "e"]);
      const reversed = { ...data, players: [...data.players].reverse(), roster: [...data.roster].reverse(),
        games: [...data.games].reverse(), forecasts: [...data.forecasts].reverse() };
      expect(evaluatePlan(reversed, intent, "outcome").assignments).toEqual(selected.assignments);
      expect(JSON.stringify(data)).toBe(original);

      data.forecasts.find(row => row.playerId === "d")!.stats.pts = 10;
      const improved = evaluatePlan(data, intent, "outcome");
      expect(improved).toMatchObject({ legal: true, activeGames: 2, assignmentValue: 18, projectedValue: 22,
        comparisonEligible: true, recommendation: { eligible: true } });
      expect(improved.assignments.map(row => [row.playerId, row.slotId]).sort()).toEqual([["a", "LW#1"], ["d", "RW#1"]]);
    });

    it.each(["absent", "null", "conditional"])("withholds crowded-day quality when a competing forecast is %s", problem => {
      const data = crowdedDay();
      const forecast = data.forecasts.find(row => row.playerId === "d")!;
      if (problem === "absent") data.forecasts = data.forecasts.filter(row => row !== forecast);
      else if (problem === "null") forecast.stats.pts = null;
      else {
        // Malformed serialized input must not inherit the unconditional contract's permissions.
        forecast.conditioning = "conditional_playing" as unknown as GameForecast["conditioning"];
        forecast.stats.pts = 1000;
        forecast.conditionalStats = { pts: 1000 };
      }
      const original = JSON.stringify(data);
      const result = evaluatePlan(data, intent, "outcome");
      expect(result).toMatchObject({ legal: true, activeGames: 2, projectedValue: null, comparisonEligible: false,
        recommendation: { eligible: false, mode: "schedule_capacity", coverage: { requiredCount: 4,
          assignmentEligibleCount: 3, totalsEligibleCount: 3, comparisonEligibleCount: 3 } } });
      expect(result.recommendation?.coverage?.exclusions).toContainEqual(expect.objectContaining({ playerId: "d", targetKey: "pts" }));
      expect(result.recommendation?.exclusions?.every(row => !row.evidence)).toBe(true);
      expect(JSON.stringify(data)).toBe(original);

      if (problem === "conditional") {
        const locked = evaluatePlan({ ...data, lockedAssignments: [{ date: data.context.startDate,
          playerId: "d", slotId: "RW#1", source: "manager" }] }, intent, "outcome");
        expect(locked.assignments).toContainEqual(expect.objectContaining({ playerId: "d", locked: true }));
        expect(locked.projectedStats.pts).toBeNull();
        expect(locked.projectedValue).toBeNull();
        expect(locked.recommendation?.eligible).toBe(false);
      }

      data.lockedAssignments = [{ date: data.context.startDate, playerId: "d", slotId: null, source: "manager" }];
      const narrowed = evaluatePlan(data, intent, "outcome");
      expect(narrowed).toMatchObject({ legal: true, projectedValue: 19, comparisonEligible: true,
        recommendation: { eligible: true } });
      expect(narrowed.assignments.map(row => row.playerId).sort()).toEqual(["a", "b"]);
    });

    it.each(["capacity", "protected drop"])("preserves the selected legal lineup after rejecting a %s change", problem => {
      const data = crowdedDay();
      data.lockedAssignments = [{ date: data.context.startDate, playerId: "e", slotId: null, source: "manager" }];
      const selectedIntent = { ...intent, protectedPlayerIds: ["b"] };
      const original = JSON.stringify({ data, selectedIntent });
      const baseline = evaluatePlan(data, selectedIntent, "outcome");
      const add = { id: "rejected-add", type: "add" as const, playerId: "f", at: data.context.asOf,
        effectiveAt: data.context.asOf, conditional: false, dependsOn: [],
        ...(problem === "protected drop" ? { dropPlayerId: "b" } : {}) };
      expect(evaluatePlan(data, selectedIntent, "outcome", [add])).toMatchObject({ legal: false,
        comparisonEligible: false, recommendation: { eligible: false } });
      expect(JSON.stringify({ data, selectedIntent })).toBe(original);
      expect(evaluatePlan(data, selectedIntent, "outcome")).toEqual(baseline);
      expect(baseline.assignments.map(row => row.playerId).sort()).toEqual(["a", "b"]);
    });
  });

  describe("unranked category decision policy", () => {
    function categoryData(values = { a: { g: 103, h: 11 }, b: { g: 102, h: 12 }, c: { g: 102, h: 12 } }) {
      const data = snapshot();
      data.context.endDate = data.context.startDate;
      data.games = data.games.filter(game => game.date === data.context.startDate);
      data.rules.scoring = { mode: "categories", weights: {}, categories: [
        { key: "g", direction: "higher" }, { key: "h", direction: "higher" },
      ] };
      data.realized = { g: 0, h: 0 };
      data.opponent = { roster: [], realized: { g: 100, h: 10 }, remaining: { g: 0, h: 0 } };
      data.forecasts = data.games.flatMap(game => data.players.filter(member => member.teamAbbreviation === game.teamAbbreviation)
        .map(member => issuedForecast(data, member.id, game.id, { stats: values[member.id as keyof typeof values] })));
      return data;
    }
    it("does not use a margin-only tradeoff or descriptive win count to displace the capacity seed", () => {
      const data = categoryData();
      const seed = evaluatePlan(data, intent, "agp"), outcome = evaluatePlan(data, intent, "outcome");
      expect(outcome.assignments).toEqual(seed.assignments);
      expect(outcome.categoryResults.map(row => row.own)).toEqual([103, 11]);
      expect(outcome.comparisonEligible).toBe(true);
      expect(outcome.recommendation?.eligible).toBe(false);
      expect(outcome.recommendation?.exclusions?.every(row => !row.evidence && row.reason !== "category_tradeoff")).toBe(true);
      expect(planRoster(data, intent, { maxSteps: 0 }).search.benchEvidence?.evaluated).toBe(0);
    });
    it("keeps the neutral seed invariant to unlike category-unit magnitudes", () => {
      const selections = [1, 1000].map(scale => {
        const data = categoryData({ a: { g: 10, h: 0 }, b: { g: 9, h: 0.1 * scale }, c: { g: 0, h: 0 } });
        return evaluatePlan(data, intent, "outcome").assignments.map(row => row.playerId);
      });
      expect(selections).toEqual([["a"], ["a"]]);
    });
    it("accepts a supported componentwise improvement without certifying a global scalar winner", () => {
      const data = categoryData({ a: { g: 100, h: 10 }, b: { g: 101, h: 11 }, c: { g: 0, h: 0 } });
      const result = evaluatePlan(data, intent, "outcome");
      expect(result.assignments.map(row => row.playerId)).toEqual(["b"]);
      expect(result.categoryResults.map(row => row.own)).toEqual([101, 11]);
      expect(result.comparisonEligible).toBe(true);
      expect(result.recommendation?.eligible).toBe(false);
    });
    it("retains supported incomparable acquisitions and preserves manager-selected moves", () => {
      const data = categoryData();
      data.players = data.players.filter(member => member.id !== "b");
      data.roster = [{ playerId: "a", position: "active" }];
      data.rules.rosterSlots = { C: 1 };
      data.forecasts = data.forecasts.filter(row => row.playerId !== "b");
      const result = planRoster(data, intent, { maxSteps: 1, maxCandidates: 1, maxEvaluations: 40 });
      const alternative = result.alternatives.find(plan => plan.steps.some(step => step.playerId === "c"));
      expect(alternative).toMatchObject({ comparisonEligible: true, projectedStats: { g: 102, h: 12 } });
      expect(alternative?.steps[0].dropPlayerId).toBe("a");
      const selectedIntent = { ...intent, steps: alternative!.steps };
      expect(planRoster(data, selectedIntent, { maxSteps: 1 }).selected.steps).toEqual(selectedIntent.steps);
      expect(result.search.limitations.some(text => /not globally ranked/.test(text))).toBe(true);
    });
    it("keeps exact-equivalent outcomes on the no-acquisition plan without a significance margin", () => {
      const data = categoryData({ a: { g: 103, h: 11 }, b: { g: 0, h: 0 }, c: { g: 103, h: 11 } });
      data.roster = [{ playerId: "a", position: "active" }];
      data.rules.rosterSlots = { C: 1 };
      const result = planRoster(data, intent, { maxSteps: 1 });
      expect(result.alternatives.every(plan => !plan.steps.length)).toBe(true);
      expect(result.selected.steps).toEqual([]);
    });
    it("retains a cheaper category improvement when a stronger plan spends an additional acquisition", () => {
      const data = categoryData();
      data.context.endDate = "2026-10-06";
      data.players = [data.players[0], data.players[2], player("d", "D", "free_agent")];
      data.roster = [{ playerId: "a", position: "active" }];
      data.rules.rosterSlots = { C: 1 };
      data.games = ["A", "C"].flatMap(team => [5, 6].map(day => ({ ...data.games[0], id: `${team}${day}`,
        teamAbbreviation: team, date: `2026-10-0${day}`, startsAt: `2026-10-0${day}T20:00:00Z`, scheduleRevision: `${team}${day}` })));
      data.games.push({ ...data.games[0], id: "D6", teamAbbreviation: "D", date: "2026-10-06", startsAt: "2026-10-06T20:00:00Z", scheduleRevision: "D6" });
      data.forecasts = data.games.flatMap(game => data.players.filter(member => member.teamAbbreviation === game.teamAbbreviation)
        .map(member => issuedForecast(data, member.id, game.id, { stats: { g: member.id === "a" ? 1 : member.id === "c" ? 2 : 3,
          h: member.id === "a" ? 1 : member.id === "c" ? 2 : 3 } })));
      const result = planRoster(data, { ...intent, alternativeCount: 20 }, { maxSteps: 2, maxCandidates: 2, maxEvaluations: 300, beamWidth: 32 });
      expect(result.alternatives.some(plan => plan.steps.filter(step => step.type === "add").length === 1 && plan.projectedStats.g === 4)).toBe(true);
      expect(result.alternatives.some(plan => plan.steps.filter(step => step.type === "add").length === 2 && plan.projectedStats.g === 5)).toBe(true);
      expect(result.search.complete).toBe(false);
    });
    it("withholds missing category and zero-exposure comparisons without treating them as dominant zeros", () => {
      const data = categoryData();
      data.forecasts[0].stats.h = null;
      expect(evaluatePlan(data, intent, "outcome")).toMatchObject({ projectedValue: null, comparisonEligible: false,
        recommendation: { eligible: false } });
      data.rules.scoring.categories = [{ key: "ratio", direction: "higher", numerator: "g", denominator: "h" }];
      data.forecasts = data.forecasts.map(row => ({ ...row, stats: { g: 0, h: 0 } }));
      data.realized = { g: 0, h: 0 };
      expect(evaluatePlan(data, intent, "outcome")).toMatchObject({ projectedValue: null, comparisonEligible: false,
        categoryResults: [{ own: null, result: "unknown" }] });
    });
    it.each(["none", "lose_goalie_categories"] as const)("respects explicit goalie coverage separately from category utility with penalty=%s", penalty => {
      const data = categoryData();
      data.players = data.players.filter(member => member.id !== "c").map(member => ({ ...member, eligiblePositions: ["G"], playerClass: "goalie" }));
      data.rules.rosterSlots = { G: 1, BN: 1 };
      data.rules.scoring.categories = [{ key: "GOALS_AGAINST_GOALIE", direction: "lower" }];
      data.rules.goalieMinimum = { required: 1, credited: 0, counts: "starts", penalty,
        periodStart: "2026-10-05T00:00:00Z", periodEnd: "2026-10-06T00:00:00Z" };
      data.realized = { GOALS_AGAINST_GOALIE: 0 };
      data.opponent = { roster: [], realized: { GOALS_AGAINST_GOALIE: 1.5 }, remaining: { GOALS_AGAINST_GOALIE: 0 } };
      data.forecasts = data.games.flatMap(game => data.players.filter(member => member.teamAbbreviation === game.teamAbbreviation)
        .map(member => issuedForecast(data, member.id, game.id, { stats: { GOALS_AGAINST_GOALIE: member.id === "a" ? 1 : 2 }, startProbability: member.id === "a" ? 0.2 : 0.8 })));
      const accepted = evaluatePlan(data, intent, "outcome"), covered = evaluatePlan(data, { ...intent, goalieCoverage: "cover" }, "outcome");
      expect(accepted.assignments).toEqual([]);
      expect(covered.assignments.map(row => row.playerId)).toEqual(["b"]);
      expect(covered.categoryResults[0].own).toBeGreaterThan(accepted.categoryResults[0].own!);
      expect(covered.limitations.some(text => /coverage preference, not category dominance/.test(text))).toBe(true);
      expect(covered.goalie).toMatchObject({ credited: 0, confirmed: 0, projected: 0.8, risk: true, minimumSatisfied: false });
      data.rules.goalieMinimum.credited = 1;
      expect(evaluatePlan(data, { ...intent, goalieCoverage: "cover" }, "outcome").assignments).toEqual([]);
      data.rules.goalieMinimum.credited = null;
      expect(evaluatePlan(data, { ...intent, goalieCoverage: "cover" }, "outcome")).toMatchObject({ goalie: { projected: null, risk: true } });
      data.rules.goalieMinimum.credited = 0;
      data.rules.goalieMinimum.counts = "unknown";
      expect(evaluatePlan(data, { ...intent, goalieCoverage: "cover" }, "outcome")).toMatchObject({ goalie: { projected: null, risk: true } });
      data.rules.goalieMinimum.counts = "starts";
      data.forecasts = data.forecasts.map(row => ({ ...row, startProbability: null }));
      expect(evaluatePlan(data, { ...intent, goalieCoverage: "cover" }, "outcome")).toMatchObject({ comparisonEligible: false,
        goalie: { projected: null, risk: true } });
    });
  });

  it.each([
    { timing: "same_day" as const, at: "2026-11-01T20:00:00Z", expected: "2026-11-01T20:00:00Z" },
    { timing: "next_day" as const, at: "2026-11-01T20:00:00Z", expected: "2026-11-02T05:00:00.000Z" },
    { timing: "next_day" as const, at: "2026-03-08T06:00:00Z", expected: "2026-03-09T04:00:00.000Z" },
    { timing: "unknown" as const, at: "2026-11-01T20:00:00Z", expected: null },
  ])("uses league-local $timing effective time across DST at $at", ({ timing, at, expected }) => {
    const data = snapshot();
    data.context.timeZone = "America/New_York";
    data.rules.acquisitionTiming = timing;
    expect(acquisitionEffectiveAt(data, data.players[2], at)).toBe(expected);
    for (const waiverClearsAt of [null, "not-a-time"]) {
      expect(acquisitionEffectiveAt(data, { ...data.players[2], availability: "waivers", waiverClearsAt }, at)).toBeNull();
    }
  });
  it("retains computed zero AGP for a quality replacement, without inventing invalid eligibility scores", () => {
    const data = snapshot();
    data.forecasts = data.forecasts.map(row => row.playerId === "c" ? { ...row, stats: { pts: 10 } } : row);
    const metrics = candidateMetrics(data, intent);
    expect(new Map(metrics.activeGames).get("c")).toBe(0);
    expect(new Map(metrics.activePoints).get("c")).toBe(16);
    data.players.find(row => row.id === "c")!.eligiblePositions = ["UNSUPPORTED"];
    expect(new Map(candidateMetrics(data, intent).activeGames).has("c")).toBe(false);
  });
  it.each([2, 13])("evaluates the entire 1000-player population across %i days with exact full-plan gains", (days) => {
    const data = snapshot();
    data.context.endDate = new Date(Date.UTC(2026, 9, 4 + days)).toISOString().slice(0, 10);
    data.games = Array.from({ length: days }, (_, index) => {
      const date = new Date(Date.UTC(2026, 9, 5 + index)).toISOString().slice(0, 10);
      return ["A", "B", "C"].map(team => ({ id: `${team}${index}`, scheduleRevision: `schedule-${team}${index}`, date, startsAt: `${date}T20:00:00Z`, teamAbbreviation: team, opponent: "X", home: true, status: "scheduled" as const }));
    }).flat();
    const template = data.players.find(row => row.id === "c")!;
    for (let index = 0; index < 997; index++) data.players.push({ ...template, id: `candidate-${index}`, nhlId: 100000 + index, name: `Candidate ${index}` });
    data.forecasts = data.games.flatMap(game => data.players.filter(member => member.teamAbbreviation === game.teamAbbreviation)
      .map(member => issuedForecast(data, member.id, game.id, { stats: { pts: member.id === "candidate-996" ? 10 : 2 } })));
    const started = performance.now();
    const metrics = candidateMetrics(data, intent);
    const elapsedMs = performance.now() - started;
    expect(metrics.activePoints.filter(([, value]) => value !== null)).toHaveLength(998);
    expect(metrics.activeGames).toHaveLength(998);
    const gains = new Map(metrics.activePoints);
    for (const id of ["c", "candidate-0", "candidate-996"]) {
      const baseline = evaluatePlan(data, intent, "outcome", [], false);
      const hypothetical = { ...data, roster: [...data.roster, { playerId: id, position: "bench" as const }],
        rules: { ...data.rules, rosterSlots: { ...data.rules.rosterSlots, BN: 2 } } };
      expect(gains.get(id)).toBe(evaluatePlan(hypothetical, intent, "outcome", [], false).projectedValue! - baseline.projectedValue!);
    }
    expect(gains.get("candidate-996")).toBe(8 * days);
    expect(elapsedMs).toBeLessThan(5000);
    console.info(JSON.stringify({ candidateBenchmark: "1000 players", days, forecasts: data.forecasts.length, evaluated: 998, elapsedMs }));
  });
  it("values points gained on usable games above extra low-value games, including displaced roster points", () => {
    const data = snapshot();
    data.context.endDate = "2026-10-08";
    data.players.push(player("d", "D", "free_agent"));
    for (const [team, days] of [["C", [7, 8]], ["D", [5, 6, 7]]] as const) for (const day of days) data.games.push({
      id: `${team}${day}`, scheduleRevision: `schedule-${team}${day}`, date: `2026-10-0${day}`, startsAt: `2026-10-0${day}T20:00:00Z`, teamAbbreviation: team, opponent: "X", home: true, status: "scheduled",
    });
    data.forecasts = data.games.flatMap(game => data.players.filter(member => member.teamAbbreviation === game.teamAbbreviation)
      .map(member => issuedForecast(data, member.id, game.id, { stats: { pts: member.id === "d" ? 10 : member.id === "c" ? 1 : member.id === "a" ? 1 : 2 } })));
    const capacity = scheduleFits(data, intent, evaluatePlan(data, intent, "agp", [], false)).fits;
    expect(capacity.find(row => row.playerIds.includes("c"))?.addedGames).toBe(2);
    expect(capacity.find(row => row.playerIds.includes("d"))?.addedGames).toBe(1);
    const gains = candidateActivePoints(data, intent);
    expect(gains.get("c")).toBe(2);
    expect(gains.get("d")).toBe(26);
    expect(candidateHorizonPoints(data).get("d")).toBe(30);
    data.forecasts = data.forecasts.filter(row => row.playerId !== "a");
    expect(candidateActivePoints(data, intent).get("d")).toBeNull();
  });
  it.each(["fewer-starts", "lower-hold-value"])("retains an improving full-roster drop/add alternative despite %s", kind => {
    const data = snapshot();
    data.players = data.players.filter(member => member.id !== "b");
    data.roster = [{ playerId: "a", position: "active" }];
    data.rules.rosterSlots = { C: 1 };
    data.games = data.games.filter(game => game.teamAbbreviation === "A"
      || game.teamAbbreviation === "C" && (kind === "lower-hold-value" || game.id === "C0"));
    data.forecasts = data.games.map(game => issuedForecast(data, game.teamAbbreviation === "A" ? "a" : "c", game.id,
      { stats: { pts: game.teamAbbreviation === "A" ? 1 : 10 } }));
    if (kind === "lower-hold-value") { data.players[0].holdValue = 10; data.players[1].holdValue = 1; }
    const before = structuredClone(data);
    const result = planRoster(data, intent, { maxSteps: 1, maxCandidates: 1, maxEvaluations: 100 });
    expect(result.baseline).toMatchObject({ activeGames: 2, projectedValue: 2, steps: [], comparisonEligible: true });
    expect(result.noMoveAgp).toMatchObject({ activeGames: 2, projectedValue: 2, steps: [] });
    expect(result.noMoveOutcome).toMatchObject({ activeGames: 2, projectedValue: 2, steps: [] });
    const alternative = result.alternatives.find(plan => plan.objective === "outcome"
      && plan.steps.some(step => step.playerId === "c" && step.dropPlayerId === "a"));
    expect(alternative).toMatchObject({ activeGames: kind === "fewer-starts" ? 1 : 2,
      projectedValue: kind === "fewer-starts" ? 10 : 20, legal: true, budgetVerified: true, comparisonEligible: true,
      acquisitions: { p: 1 } });
    expect(alternative?.steps).toHaveLength(1);
    expect(alternative?.limitations.some(value => value.includes("Future availability for c must be rechecked"))).toBe(true);
    expect(result.selected.steps).toEqual(intent.steps);
    expect(data).toEqual(before);
    const protectedResult = planRoster(data, { ...intent, protectedPlayerIds: ["a"] }, { maxSteps: 1, maxCandidates: 1 });
    expect(protectedResult.alternatives.every(plan => plan.steps.length === 0)).toBe(true);
  });
  it("ranks candidate horizon points only from complete permitted forecast coverage", () => {
    const data = snapshot();
    expect(candidateHorizonPoints(data).get("c")).toBe(4);
    const changed = (forecast: GameForecast) => { data.forecasts = data.forecasts.map(row => row.playerId === "c" && row.gameId === "C0" ? forecast : row); };
    const original = data.forecasts.find(row => row.playerId === "c" && row.gameId === "C0")!;
    for (const patch of [
      { allowedUses: { assignment: true, totals: true, comparison: false, conditionalTieBreak: true } },
      { allowedUses: { assignment: true, totals: false, comparison: true, conditionalTieBreak: true } },
      { conditioning: "conditional_appearance" as unknown as GameForecast["conditioning"] },
      { stats: { pts: null } }, { expiresAt: data.context.asOf }, { issuedContext: undefined },
    ]) {
      changed({ ...original, ...patch });
      expect(candidateHorizonPoints(data).get("c")).toBeNull();
    }
    changed(original);
    data.forecasts.push({ ...original, stats: { pts: 999 } });
    expect(candidateHorizonPoints(data).get("c")).toBeNull();
  });
  it("keeps absent, category and unverified-eligibility candidate points unavailable, preserving real zero", () => {
    const data = snapshot();
    data.forecasts = data.forecasts.map(row => row.playerId === "c" ? { ...row, stats: { pts: 0 } } : row);
    expect(candidateHorizonPoints(data).get("c")).toBe(0);
    data.players.find(row => row.id === "c")!.eligibilityVerified = false;
    expect(candidateHorizonPoints(data).get("c")).toBeNull();
    data.players.find(row => row.id === "c")!.eligibilityVerified = true;
    data.rules.scoring.mode = "categories";
    expect(candidateHorizonPoints(data).get("c")).toBeNull();
    data.rules.scoring.mode = "points";
    data.forecasts = data.forecasts.filter(row => row.playerId !== "c");
    expect(candidateHorizonPoints(data).get("c")).toBeNull();
  });
  it.each(["manual", "yahoo"] as const)("retains %s legacy workspaces without granting unproven forecast recommendations", (provider) => {
    const data = snapshot();
    data.context.provider = provider;
    data.forecasts = data.forecasts.map(row => ({ ...row, sourceKind: undefined, issuedContext: undefined,
      sourceWatermark: undefined, cutoffAt: undefined, expiresAt: undefined, assignmentStats: { pts: 999 } }));
    data.lockedAssignments = [{ date: data.context.startDate, playerId: "a", slotId: "C#1" }];
    data.realized = { pts: 100 };
    const retained = snapshotSchema.parse(JSON.parse(JSON.stringify(data)));
    const resolved = snapshotSchema.parse(JSON.parse(JSON.stringify(resolvePlanningContributions(retained))));
    expect(resolved.forecastInputExclusions?.some(row => row.reasons.includes("identity_conflict"))).toBe(true);
    const result = planRoster(retained, intent, { maxSteps: 0 });
    expect(result.baseline.recommendation?.eligible).toBe(false);
    expect(result.baseline.recommendation?.mode).toBe("schedule_capacity");
    expect(result.baseline.projectedValue).toBeNull();
    expect(result.baseline.comparisonEligible).toBe(false);
    expect(result.baseline.assignments).toContainEqual({ date: data.context.startDate, playerId: "a", gameId: "A0", slotId: "C#1", locked: true });
    expect(result.baseline.recommendation?.coverage?.exclusions.some(row => row.reasons.includes("identity_conflict"))).toBe(true);
    expect(retained.realized).toEqual({ pts: 100 });
    expect(retained.forecasts[0].assignmentStats?.pts).toBe(999);
  });
  it("keeps missing and mixed Kaprizov/Knies/Batherson coverage schedule-only", () => {
    const data = snapshot();
    data.context.endDate = data.context.startDate;
    data.players = [
      { ...player("kaprizov", "MIN"), eligiblePositions: ["LW"] },
      { ...player("knies", "TOR"), eligiblePositions: ["LW"] },
      { ...player("batherson", "OTT"), eligiblePositions: ["RW"] },
    ];
    data.roster = data.players.map(p => ({ playerId: p.id, position: "bench" }));
    data.rules.rosterSlots = { LW: 1, RW: 1, BN: 1 };
    data.games = data.players.map(p => ({ ...data.games[0], id: p.id, teamAbbreviation: p.teamAbbreviation! }));
    const forecasts = data.players.map(p => issuedForecast(data, p.id, p.id,
      { stats: { pts: p.id === "kaprizov" ? 9 : p.id === "knies" ? 4 : 5 } }));
    for (const supplied of [[], forecasts.filter(f => f.playerId !== "kaprizov")]) {
      data.forecasts = supplied;
      const result = planRoster(data, intent, { maxSteps: 0 });
      expect(result.baseline.objective).toBe("agp");
      expect(result.baseline.projectedValue).toBeNull();
      expect(result.baseline.recommendation).toMatchObject({ eligible: false, mode: "schedule_capacity" });
      expect(result.baseline.recommendation!.unresolved.some(issue => issue.playerId === "kaprizov")).toBe(true);
      expect(result.noMoveOutcome.projectedValue).toBeNull();
    }
    data.forecasts = forecasts;
    const complete = planRoster(data, intent, { maxSteps: 0 });
    expect(complete.baseline.assignments.map(a => a.playerId).sort()).toEqual(["batherson", "kaprizov"]);
    expect(complete.baseline.recommendation?.eligible).toBe(true);
    expect(complete.baseline.recommendation?.exclusions?.find(row => row.playerId === "knies")).toMatchObject({
      reason: "lower_lineup_value", evidence: { scoreBasis: "points_assignment", selectedScore: 14, withPlayerScore: 9,
        slotChanges: [{ date: data.context.startDate, slotId: "LW#1", selectedPlayerId: "kaprizov", withPlayerId: "knies" }] } });
    data.lockedAssignments = [{ date: data.context.startDate, playerId: "knies", slotId: "LW#1" }];
    const locked = planRoster(data, intent, { maxSteps: 0 });
    expect(locked.baseline.assignments.some(a => a.playerId === "knies" && a.locked)).toBe(true);
    expect(locked.baseline.recommendation?.exclusions?.find(row => row.playerId === "kaprizov")?.reason).toBe("locked_capacity");
    data.lockedAssignments = [];
    data.forecasts = forecasts.map(row => row.playerId === "kaprizov"
      ? { ...row, stats: { pts: 0 }, conditionalStats: { pts: 9 }, appearanceProbability: 0 } : row);
    const unavailable = planRoster(data, intent, { maxSteps: 0 });
    expect(unavailable.baseline.recommendation?.eligible).toBe(true);
    expect(unavailable.baseline.assignments.map(row => row.playerId).sort()).toEqual(["batherson", "knies"]);
    const absence = unavailable.baseline.recommendation?.exclusions?.find(row => row.playerId === "kaprizov");
    expect(absence?.evidence).toMatchObject({ selectedScore: 9, withPlayerScore: 5 });
    expect(absence?.evidence?.sources).toContainEqual(expect.objectContaining({ playerId: "kaprizov",
      participation: [{ gameId: "kaprizov", basis: "appearance", probability: 0, confirmed: false }] }));
    data.forecasts = forecasts.map(row => row.playerId === "kaprizov" ? { ...row, stats: { pts: 4 } } : row);
    const tied = planRoster(data, intent, { maxSteps: 0 });
    expect(tied.baseline.recommendation?.exclusions?.[0]).toMatchObject({ reason: "equal_lineup_value",
      evidence: { selectedScore: 9, withPlayerScore: 9 } });
  });
  it("explains the best legal LW/RW and UTIL reassignment without name or input-order exceptions", () => {
    const data = snapshot();
    data.context.endDate = data.context.startDate;
    data.players = [{ ...player("kaprizov", "MIN"), eligiblePositions: ["LW"] },
      { ...player("knies", "TOR"), eligiblePositions: ["LW", "RW"] },
      { ...player("batherson", "OTT"), eligiblePositions: ["RW"] }, player("center", "SEA")];
    data.roster = data.players.map(item => ({ playerId: item.id, position: "bench" }));
    data.rules.rosterSlots = { LW: 1, RW: 1, UTIL: 1, BN: 1 };
    data.games = data.players.map(item => ({ ...data.games[0], id: item.id, teamAbbreviation: item.teamAbbreviation! }));
    const values = { kaprizov: 9, knies: 10, batherson: 7, center: 8 };
    data.forecasts = data.players.map(item => issuedForecast(data, item.id, item.id, { stats: { pts: values[item.id as keyof typeof values] } }));
    const result = planRoster(data, intent, { maxSteps: 0 });
    const explanation = result.selected.recommendation?.exclusions?.find(row => row.playerId === "batherson");
    expect(explanation).toMatchObject({ reason: "lower_lineup_value", evidence: { selectedScore: 27, withPlayerScore: 26 } });
    expect(explanation?.evidence?.slotChanges).toEqual([
      { date: data.context.startDate, slotId: "LW#1", selectedPlayerId: "kaprizov", withPlayerId: "knies" },
      { date: data.context.startDate, slotId: "RW#1", selectedPlayerId: "knies", withPlayerId: "batherson" },
      { date: data.context.startDate, slotId: "UTIL#1", selectedPlayerId: "center", withPlayerId: "kaprizov" },
    ]);
    expect(explanation?.evidence?.sources.map(source => source.playerId)).toEqual(["batherson", "center", "kaprizov", "knies"]);
    const permuted = structuredClone(data);
    permuted.players.reverse(); permuted.roster.reverse(); permuted.games.reverse(); permuted.forecasts.reverse();
    permuted.players.forEach(item => { item.name = `Renamed ${item.id}`; });
    expect(planRoster(permuted, intent, { maxSteps: 0 }).selected.recommendation).toEqual(result.selected.recommendation);
  });
  it.each([1, 1e-9])("withholds quality certification when a checked legal placement improves the selected lineup at scale %s", weight => {
    const data = snapshot();
    data.context.endDate = data.context.startDate;
    data.rules.scoring.weights = { pts: weight };
    const inferior = evaluatePlan({ ...data, lockedAssignments: [{ date: data.context.startDate, playerId: "a", slotId: "C#1" }] }, intent, "outcome", [], false);
    const result = explainBenchDecisions({ snapshot: data, intent, evaluation: inferior,
      scopeForDate: date => ({ dates: [date], locks: [] }),
      evaluateForced: placement => evaluatePlan({ ...data, lockedAssignments: [{ ...placement, slotId: placement.slotId ?? "C#1" }] }, intent, "outcome", [], false) });
    expect(result.recommendation).toMatchObject({ eligible: false, mode: "schedule_capacity" });
    expect(result.comparisonEligible).toBe(false);
    expect(result.recommendation?.exclusions?.[0]).toMatchObject({ reason: "decision_unresolved",
      evidence: { selectedScore: weight, withPlayerScore: 2 * weight } });
  });
  it("counts competing bench targets and explains missing discovery by opportunity", () => {
    const data = snapshot();
    data.context.endDate = data.context.startDate;
    data.forecasts = data.forecasts.filter(row => row.playerId !== "b");
    data.forecastManifest = { version: "planning-forecasts-v1", id: "manifest", seasonId: data.context.seasonId,
      asOf: data.context.asOf, scheduleRevision: "schedule", rosterRevision: "roster",
      issuedRevisionIds: ["r"], baselineChecksum: null, requiredOpportunities: 2,
      forecastedOpportunities: 1, exclusionCounts: { discovery_failed: 1 },
      exclusions: [{ gameId: "B0", reasons: ["discovery_failed"] }] };
    const result = evaluatePlan(data, intent, "outcome");
    expect(result.recommendation?.coverage).toMatchObject({ requiredCount: 2,
      assignmentEligibleCount: 1, totalsEligibleCount: 1, comparisonEligibleCount: 1 });
    expect(result.recommendation?.coverage?.exclusions).toEqual([{ playerId: "b", gameId: "B0",
      targetKey: "pts", reasons: ["discovery_failed"] }]);
    expect(result.recommendation?.unresolved.find(row => row.playerId === "b")?.reasons)
      .toContain("discovery_failed");
    data.forecastManifest.exclusions = [{ gameId: "B0", playerId: "b", targetKey: "pts",
      reasons: ["missing_participation"] }];
    expect(evaluatePlan(data, intent, "outcome").recommendation?.coverage?.exclusions[0].reasons)
      .toEqual(["missing_participation"]);
    data.lockedAssignments = [{ date: data.context.startDate, playerId: "a", slotId: "C#1" }];
    expect(evaluatePlan(data, intent, "outcome").recommendation?.coverage?.requiredCount).toBe(1);
  });
  it("deduplicates identical forecast rows and rejects conflicting duplicates in either order", () => {
    const data = snapshot();
    data.context.endDate = data.context.startDate;
    const original = data.forecasts.find(row => row.playerId === "b" && row.gameId === "B0")!;
    data.forecasts.push({ ...original, stats: { ...original.stats } });
    expect(evaluatePlan(data, intent, "outcome").recommendation?.eligible).toBe(true);
    data.forecasts[data.forecasts.length - 1] = { ...original, revisionId: "conflicting-revision", stats: { pts: 99 } };
    const forward = planRoster(data, intent, { maxSteps: 0 });
    const reversed = planRoster({ ...data, forecasts: [...data.forecasts].reverse() }, intent, { maxSteps: 0 });
    for (const result of [forward, reversed]) {
      expect(result.baseline.objective).toBe("agp");
      expect(result.baseline.projectedValue).toBeNull();
      expect(result.baseline.recommendation?.eligible).toBe(false);
      expect(result.baseline.recommendation?.coverage?.exclusions).toContainEqual({
        playerId: "b", gameId: "B0", targetKey: "pts", reasons: ["conflicting_forecast"],
      });
    }
    expect(forward.baseline.assignments).toEqual(reversed.baseline.assignments);
    expect(forward.baseline.forecastManifestId).toBe(reversed.baseline.forecastManifestId);
  });
  it("rejects conflicting resolved target identities without a last-wins coverage result", () => {
    const data = snapshot();
    const game = { seasonId: data.context.seasonId, gameId: 30, playerId: 7, nhlPlayerId: 77,
      teamId: 1, scheduledAt: "2026-10-05T20:00:00Z", scheduleRevision: "s", rosterRevision: "r" };
    const resolved = (mean: number) => ({ resolverVersion: "contribution-resolver-v1" as const,
      game, targetKey: "pts", sourceKind: "detailed" as const, conditionalMean: null,
      unconditionalMean: mean, unit: "count" as const, basis: "unconditional_game" as const,
      allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
      sourceIds: [`revision-${mean}`], participationRevisionId: null, blendWeight: null,
      exclusionReasons: [], limitations: [] });
    data.forecasts = data.forecasts.map(row => row.playerId === "a" ? {
      ...row, contributions: { pts: resolved(row.gameId === "A0" ? 1 : 2) },
    } : row);
    const result = evaluatePlan(data, intent, "outcome");
    expect(result.recommendation?.eligible).toBe(false);
    expect(result.projectedValue).toBeNull();
    expect(result.projectedStats.pts).toBeNull();
    expect(result.recommendation?.coverage?.exclusions).toContainEqual({
      playerId: "a", gameId: "A0", targetKey: "pts", reasons: expect.arrayContaining(["conflicting_forecast"]),
    });
    data.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "pts", direction: "higher" }] };
    data.opponent = { roster: [], realized: { pts: 0 }, remaining: { pts: 1 } };
    const category = evaluatePlan(data, intent, "outcome");
    expect(category.projectedStats.pts).toBeNull();
    expect(category.categoryResults).toEqual([{ key: "pts", own: null, opponent: 1, result: "unknown" }]);
  });
  it("allows an independently usable baseline after rejecting conflicting detailed rows", () => {
    const data = snapshot();
    data.context.endDate = data.context.startDate;
    data.players = [{ ...player("7", "A"), nhlId: 77, nhlTeamId: 1, rosterRevision: "roster-a" }];
    data.roster = [{ playerId: "7", position: "active" }];
    data.games = [{ ...data.games[0], id: "30", scheduleRevision: "schedule-a" }];
    const first = { ...data.forecasts[0], playerId: "7", gameId: "30", stats: { pts: 1 }, revisionId: "first" };
    data.forecasts = [first, { ...first, stats: { pts: 10 }, revisionId: "second" }];
    data.baselineSources = [{ kind: "baseline", sourceId: "independent-rate", policyVersion: "rate-v1",
      released: true, allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
      playerId: 7, nhlPlayerId: 77, seasonId: data.context.seasonId, teamId: 1, targetKey: "pts",
      unit: "count", basis: "per_team_game", mean: 3, participationIntegrated: true,
      cutoffAt: "2026-10-03T00:00:00Z", issuedAt: "2026-10-03T01:00:00Z",
      expiresAt: "2026-10-06T00:00:00Z", sourceWatermark: "w",
      scheduleRevision: "schedule-a", rosterRevision: "roster-a" }];
    const result = evaluatePlan(data, intent, "outcome");
    expect(result.recommendation?.eligible).toBe(true);
    expect(result.projectedValue).toBe(3);
    expect(result.forecastInputs?.[0].sourceKind).toBe("baseline");
    expect(result.recommendation?.coverage?.exclusions).toEqual([]);
    expect(result.forecastManifestId).toBe(data.id);
    expect(comparePlanSensitivity(data, result, result).direction).toBe("equal");
  });
  it("propagates missing quality through LW/RW and UTIL but preserves other components", () => {
    const data = snapshot();
    data.context.endDate = data.context.startDate;
    data.players = [{ ...player("a", "A"), eligiblePositions: ["LW", "RW"] },
      { ...player("b", "B"), eligiblePositions: ["LW"] }, { ...player("d", "D"), eligiblePositions: ["D"] }];
    data.roster = data.players.map(p => ({ playerId: p.id, position: "bench" }));
    data.games = data.players.map(p => ({ ...data.games[0], id: p.id, teamAbbreviation: p.teamAbbreviation! }));
    data.forecasts = data.players.filter(p => p.id !== "b").map(p => issuedForecast(data, p.id, p.id, { stats: { pts: -2 } }));
    data.rules.rosterSlots = { LW: 1, RW: 1, D: 1, BN: 3 };
    const disconnected = evaluatePlan(data, intent, "outcome");
    expect(disconnected.assignments.map(a => a.playerId).sort()).toEqual(["a", "b"]);
    data.rules.rosterSlots.UTIL = 1;
    const bridged = evaluatePlan(data, intent, "outcome");
    expect(bridged.assignments.map(a => a.playerId).sort()).toEqual(["a", "b", "d"]);
    expect(bridged.recommendation?.coverage?.requiredCount).toBe(3);
    expect(bridged.recommendation?.coverage?.exclusions).toContainEqual({
      playerId: "b", gameId: "b", targetKey: "pts", reasons: ["no_issued_revision"],
    });
  });
  it("does not infer complete category totals from partial active targets or bench coverage", () => {
    const data = snapshot();
    data.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "pts", direction: "higher" }] };
    data.opponent = { roster: [], realized: { pts: 0 }, remaining: { pts: 1 } };
    data.forecasts = data.forecasts.filter(f => f.playerId !== "b");
    const result = planRoster(data, intent, { maxSteps: 0 });
    expect(result.baseline.projectedValue).toBeNull();
    expect(result.baseline.categoryResults[0].result).toBe("unknown");
  });
  it.each([false, undefined])("keeps %s eligibility verification unresolved until explicitly verified", (verification) => {
    const data = snapshot();
    data.players[0].eligibilityVerified = verification;
    const result = evaluatePlan(data, intent, "outcome");
    expect(result.projectedValue).toBeNull();
    expect(result.recommendation?.eligible).toBe(false);
    expect(result.limitations.some(value => value.includes("positional eligibility"))).toBe(true);
    data.players[0].eligibilityVerified = true;
    expect(evaluatePlan(data, intent, "outcome").recommendation?.eligible).toBe(true);
  });
  it("preserves locked assignments and realized results without certifying absent eligibility", () => {
    const data = snapshot();
    delete data.players[0].eligibilityVerified;
    data.realized = { pts: 7 };
    data.lockedAssignments = [{ date: data.games[0].date, playerId: "a", slotId: "C#1" }];
    const result = evaluatePlan(data, intent, "outcome");
    expect(result.assignments).toContainEqual(expect.objectContaining({ playerId: "a", locked: true }));
    expect(result.recommendation?.eligible).toBe(false);
    expect(result.projectedValue).toBeNull();
    expect(result.recommendation?.unresolved).toContainEqual(expect.objectContaining({ playerId: "a" }));
    expect(data.realized).toEqual({ pts: 7 });
  });
  it("honors assignment-only and totals-only permissions independently", () => {
    const data = snapshot();
    data.forecasts = data.forecasts.map(row => ({ ...row, allowedUses: { assignment: true, totals: false, comparison: false, conditionalTieBreak: false } }));
    const assigned = planRoster(data, intent, { maxSteps: 0 });
    expect(assigned.baseline.objective).toBe("outcome");
    expect(assigned.baseline.assignments.every(row => row.playerId === "b")).toBe(true);
    expect(assigned.baseline.recommendation?.eligible).toBe(true);
    expect(assigned.baseline.projectedStats.pts).toBeNull();
    expect(assigned.baseline.projectedValue).toBeNull();
    expect(assigned.baseline.comparisonEligible).toBe(false);
    expect(assigned.baseline.recommendation?.exclusions?.[0].evidence).toMatchObject({
      scoreBasis: "points_assignment", selectedScore: 4, withPlayerScore: 3 });
    data.forecasts = data.forecasts.map(row => ({ ...row, allowedUses: { assignment: false, totals: true, comparison: false, conditionalTieBreak: false } }));
    const totals = planRoster(data, intent, { maxSteps: 0 });
    expect(totals.baseline.recommendation?.eligible).toBe(false);
    expect(totals.baseline.objective).toBe("agp");
    expect(totals.baseline.projectedStats.pts).not.toBeNull();
    expect(totals.baseline.comparisonEligible).toBe(false);
  });
  it("does not grant legacy forecasts unapproved uses or quality acquisition comparisons", () => {
    const data = snapshot();
    data.forecasts.forEach(row => { delete row.allowedUses; });
    expect(planRoster(data, intent, { maxSteps: 0 }).baseline.recommendation?.eligible).toBe(false);
    data.forecasts = snapshot().forecasts.map(row => ({ ...row, allowedUses: { assignment: true, totals: true, comparison: false, conditionalTieBreak: false }, stats: { pts: row.playerId === "c" ? 10 : 1 } }));
    const result = planRoster(data, intent, { maxSteps: 1 });
    expect(result.baseline.projectedValue).not.toBeNull();
    expect(result.baseline.comparisonEligible).toBe(false);
    expect(result.alternatives.some(row => row.steps.some(step => step.dropPlayerId))).toBe(false);
  });
  it("retains exact resolved forecast values and manifest with completed assignments", () => {
    const data = snapshot();
    const result = planRoster(data, intent, { maxSteps: 0 });
    expect(result.baseline.forecastManifestId).toBe(data.id);
    expect(result.baseline.forecastInputs?.map(row => `${row.playerId}:${row.gameId}`).sort()).toEqual(result.baseline.assignments.map(row => `${row.playerId}:${row.gameId}`).sort());
    expect(result.baseline.forecastInputs?.reduce((sum, row) => sum + (row.stats.pts ?? 0), 0)).toBe(result.baseline.projectedValue);
  });
  it("uses conditional ability only for a fully comparable schedule tie", () => {
    const data = snapshot();
    data.forecasts = data.forecasts.map(row => ({ ...row, stats: { pts: null }, tieBreakStats: { pts: row.playerId === "a" ? 5 : 2 } }));
    const result = evaluatePlan(data, intent, "agp");
    expect(result.assignments.every(row => row.playerId === "a")).toBe(true);
    expect(result.projectedValue).toBeNull();
    expect(result.recommendation?.eligible).toBe(false);
    expect(result.limitations.some(value => value.includes("assuming participation"))).toBe(true);
    expect(result.recommendation?.exclusions?.every(row => row.evidence === undefined)).toBe(true);
    data.forecasts = data.forecasts.filter(row => row.playerId !== "b");
    expect(evaluatePlan(data, intent, "agp").limitations.some(value => value.includes("assuming participation"))).toBe(false);
  });
  it("rejects expired quality evidence without changing realized results", () => {
    const data = snapshot();
    data.realized = { pts: 7 };
    data.forecasts = data.forecasts.map(row => ({ ...row, expiresAt: data.context.asOf }));
    const result = evaluatePlan(data, intent, "outcome");
    expect(result.projectedValue).toBeNull();
    expect(result.recommendation?.eligible).toBe(false);
    expect(data.realized).toEqual({ pts: 7 });
  });
  it("keeps a coherent no-move baseline and finds an acquisition with a legal drop", () => {
    const data = snapshot();
    data.forecasts = data.forecasts.map(item => item.playerId === "c" ? { ...item, stats: { pts: 3 } } : item);
    const result = planRoster(data, intent, { maxEvaluations: 100, beamWidth: 4, maxSteps: 1 });
    expect(result.snapshotId).toBe(data.id);
    expect(result.baseline.steps).toEqual([]);
    expect(result.noMoveAgp.activeGames).toBe(2);
    expect(result.alternatives[0].steps).toEqual([]);
    expect(result.alternatives.some(item => item.steps.some(step => step.playerId === "c" && step.dropPlayerId))).toBe(true);
  });
  it("enforces capacity, dependencies, protections, and period budget", () => {
    const data = snapshot();
    const add = { id: "add", type: "add" as const, playerId: "c", at: "2026-10-05T00:00:00Z", effectiveAt: "2026-10-05T00:00:00Z", conditional: true, dependsOn: [] };
    expect(evaluatePlan(data, intent, "agp", [add]).legal).toBe(false);
    expect(evaluatePlan(data, { ...intent, protectedPlayerIds: ["b"] }, "agp", [{ ...add, dropPlayerId: "b" }]).legal).toBe(false);
    expect(evaluatePlan(data, intent, "agp", [{ ...add, dropPlayerId: "b" }]).legal).toBe(true);
    data.lockedAssignments = [{ date: data.context.startDate, playerId: "a", slotId: "C#1" }];
    const selectedIntent = { ...intent, protectedPlayerIds: ["a"], steps: [{ ...add, dropPlayerId: "b" }] };
    const before = JSON.stringify({ intent: selectedIntent, locks: data.lockedAssignments });
    const original = evaluatePlan(data, selectedIntent, "outcome", selectedIntent.steps);
    expect(original.projectedValue).toBe(3);
    data.rules.scoring.weights.pts = 2;
    const recalculated = evaluatePlan(data, selectedIntent, "outcome", selectedIntent.steps);
    expect(recalculated.projectedValue).toBe(original.projectedValue! * 2);
    expect(recalculated.legal).toBe(true);
    expect(recalculated.steps).toEqual(selectedIntent.steps);
    expect(recalculated.assignments).toContainEqual({ date: data.context.startDate, playerId: "a", gameId: "A0", slotId: "C#1", locked: true });
    expect(JSON.stringify({ intent: selectedIntent, locks: data.lockedAssignments })).toBe(before);
    data.rules.periods[0].remaining = 0;
    expect(evaluatePlan(data, intent, "agp", [{ ...add, dropPlayerId: "b" }]).legal).toBe(false);
  });
  it("uses independent weekly lock windows and excludes additions after lock", () => {
    const data = snapshot();
    data.rules.lineupMode = "weekly";
    expect(evaluatePlan(data, intent, "agp").legal).toBe(false);
    data.rules.lineupPeriods = [{ id: "w", start: "2026-10-05T00:00:00Z", end: "2026-10-12T00:00:00Z", lockAt: "2026-10-05T00:00:00Z" }];
    expect(evaluatePlan(data, intent, "agp").legal).toBe(true);
    const add = { id: "add", type: "add" as const, playerId: "c", dropPlayerId: "a", at: "2026-10-06T00:00:00Z", effectiveAt: "2026-10-06T00:00:00Z", conditional: true, dependsOn: [] };
    const result = evaluatePlan(data, intent, "agp", [add]);
    expect(result.assignments.some(row => row.playerId === "c")).toBe(false);
  });
  it("honors a midpoint weekly lock from the start of its window and rejects conflicting locks", () => {
    const data = snapshot();
    data.rules.lineupMode = "weekly";
    data.rules.lineupPeriods = [{ id: "w", start: "2026-10-05T00:00:00Z", end: "2026-10-12T00:00:00Z", lockAt: "2026-10-05T00:00:00Z" }];
    data.lockedAssignments = [{ date: "2026-10-06", playerId: "a", slotId: "C#1" }, { date: "2026-10-06", playerId: "b", slotId: null }];
    const result = evaluatePlan(data, intent, "outcome");
    expect(result.legal).toBe(true);
    expect(result.assignments.map(row => row.playerId)).toEqual(["a", "a"]);
    expect(result.limitations.some(value => value.includes("conflicts with weekly lineup"))).toBe(false);
    data.lockedAssignments.push({ date: "2026-10-05", playerId: "b", slotId: "C#1" });
    const conflict = evaluatePlan(data, intent, "outcome");
    expect(conflict.legal).toBe(false);
    expect(conflict.limitations).toContain("Conflicting weekly locks in w.");
  });
  it("includes the last local day of a weekly window in UTC+14", () => {
    const data = snapshot();
    data.context.timeZone = "Pacific/Kiritimati";
    data.games = data.games.map(game => ({ ...game, startsAt: `${game.date}T06:00:00Z` }));
    data.rules.lineupMode = "weekly";
    data.rules.lineupPeriods = [{ id: "w", start: "2026-10-04T10:00:00Z", end: "2026-10-06T10:00:00Z", lockAt: "2026-10-04T10:00:00Z" }];
    data.lockedAssignments = [{ date: "2026-10-06", playerId: "a", slotId: "C#1" }];
    const result = evaluatePlan(data, intent, "outcome");
    expect(result.legal).toBe(true);
    expect(result.assignments.map(row => row.playerId)).toEqual(["a", "a"]);
    expect(result.limitations.some(value => value.includes("conflicts with weekly lineup"))).toBe(false);
  });
  it("unlocks a bench player at the next New York midnight after DST ends", () => {
    const data = snapshot();
    data.context.timeZone = "America/New_York";
    data.context.asOf = "2026-10-31T00:00:00Z";
    data.context.startDate = "2026-11-01"; data.context.endDate = "2026-11-02";
    data.games = []; data.forecasts = [];
    data.lockedAssignments = [{ date: "2026-11-01", playerId: "b", slotId: null }];
    const drop = { id: "drop", type: "drop" as const, playerId: "b", at: "2026-11-02T04:59:00Z", effectiveAt: "2026-11-02T04:59:00Z", conditional: false, dependsOn: [] };
    expect(evaluatePlan(data, intent, "agp", [drop]).legal).toBe(false);
    expect(evaluatePlan(data, intent, "agp", [{ ...drop, at: "2026-11-02T05:00:00Z", effectiveAt: "2026-11-02T05:00:00Z" }]).legal).toBe(true);
  });
  it("holds a daily slot lock past puck drop until the next league-local midnight", () => {
    const data = snapshot();
    data.players[0].reserveEligibility = ["IR"];
    data.rules.rosterSlots.IR = 1;
    // a's 10-05 game starts at 20:00Z and the provider has locked him in C#1 for that day.
    data.lockedAssignments = [{ date: "2026-10-05", playerId: "a", slotId: "C#1" }];
    const moves = (at: string) => [
      { id: "drop", type: "drop" as const, playerId: "a", at, effectiveAt: at, conditional: false, dependsOn: [] },
      { id: "swap", type: "add" as const, playerId: "c", dropPlayerId: "a", at, effectiveAt: at, conditional: true, dependsOn: [] },
      { id: "reserve", type: "reserve" as const, playerId: "a", reservePosition: "IR" as const, at, effectiveAt: at, conditional: false, dependsOn: [] },
    ];
    const legal = (step: ReturnType<typeof moves>[number]) => { const timeline = buildTimeline(data, intent, [step]); timeline.at(step.effectiveAt); return timeline.legal; };
    for (const at of ["2026-10-05T20:00:00Z", "2026-10-05T21:00:00Z", "2026-10-05T23:59:59Z"]) for (const step of moves(at)) expect(legal(step), `${step.id} at ${at}`).toBe(false);
    for (const step of moves("2026-10-06T00:00:00Z")) expect(legal(step), `${step.id} at midnight`).toBe(true);
  });
  it("holds a daily slot lock until the New York midnight after DST ends", () => {
    const data = snapshot();
    data.context.timeZone = "America/New_York";
    data.context.asOf = "2026-10-31T00:00:00Z";
    data.games = [{ ...data.games[0], id: "A-nov1", date: "2026-11-01", startsAt: "2026-11-01T23:00:00Z" }];
    data.forecasts = [];
    data.lockedAssignments = [{ date: "2026-11-01", playerId: "a", slotId: "C#1" }];
    const drop = (at: string) => { const timeline = buildTimeline(data, intent, [{ id: "drop", type: "drop", playerId: "a", at, effectiveAt: at, conditional: false, dependsOn: [] }]); timeline.at(at); return timeline.legal; };
    // 23:59 EST on Nov 1 is still the locked day; a fixed EDT offset would have released him at 04:00Z.
    expect(drop("2026-11-02T04:59:00Z")).toBe(false);
    expect(drop("2026-11-02T05:00:00Z")).toBe(true);
  });
  it("combines ratio components and reports missing forecasts without zeros", () => {
    const data = snapshot();
    data.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "pct", direction: "higher", numerator: "made", denominator: "attempts" }] };
    data.forecasts = data.forecasts.map(item => ({ ...item, stats: { made: item.playerId === "a" ? 1 : 3, attempts: item.playerId === "a" ? 2 : 4 } }));
    data.realized = { made: 1, attempts: 2 };
    data.opponent = { roster: [], realized: { made: 1, attempts: 2 }, remaining: { made: 1, attempts: 2 } };
    const result = evaluatePlan(data, intent, "agp");
    expect(result.categoryResults[0].own).toBe(0.7);
    data.forecasts = data.forecasts.filter(item => item.gameId !== "B1" && item.gameId !== "A1");
    const missing = evaluatePlan(data, intent, "agp");
    expect(missing.projectedValue).toBeNull();
    expect(missing.limitations.some(value => value.includes("forecast"))).toBe(true);
  });
  it("aggregates GAA from goalie minutes without requiring minutes from skaters", () => {
    const data = snapshot();
    data.players[1] = { ...data.players[1], playerClass: "goalie", eligiblePositions: ["G"] };
    data.rules.rosterSlots = { C: 1, G: 1, BN: 1 };
    data.rules.scoring = { mode: "categories", weights: {}, categories: [
      { key: "GOALS_AGAINST_AVERAGE", direction: "lower", numerator: "GOALS_AGAINST_GOALIE",
        denominator: "GOALIE_MINUTES", multiplier: 60 },
    ] };
    data.forecasts = data.forecasts.map((row): GameForecast => ({ ...row, stats: row.playerId === "b"
      ? { GOALS_AGAINST_GOALIE: 1, GOALIE_MINUTES: row.gameId === "B0" ? 30 : 60 } : { pts: 1 } }));
    data.realized = { GOALS_AGAINST_GOALIE: 1, GOALIE_MINUTES: 60 };
    data.opponent = { roster: [], realized: { GOALS_AGAINST_GOALIE: 4, GOALIE_MINUTES: 60 },
      remaining: { GOALS_AGAINST_GOALIE: 0, GOALIE_MINUTES: 0 } };
    const result = evaluatePlan(data, intent, "agp");
    expect(result.categoryResults[0].own).toBeCloseTo(3 / 150 * 60);
    expect(result.recommendation?.unresolved).toEqual([]);
    data.forecasts = data.forecasts.map(row => row.playerId === "b"
      ? { ...row, stats: { ...row.stats, GOALIE_MINUTES: null } } : row);
    expect(evaluatePlan(data, intent, "outcome").categoryResults[0].own).toBeNull();
  });
  it("uses local calendar dates for next-day acquisition and charges actual cost", () => {
    const data = snapshot();
    data.context.timeZone = "America/Los_Angeles";
    data.rules.acquisitionTiming = "next_day";
    data.rules.acquisitionCost = 2;
    data.rules.periods[0].remaining = 1;
    const add = { id: "add", type: "add" as const, playerId: "c", dropPlayerId: "b", at: "2026-10-05T06:30:00Z", effectiveAt: "2026-10-05T06:45:00Z", conditional: true, dependsOn: [] };
    expect(evaluatePlan(data, intent, "agp", [add]).legal).toBe(false); // Both times are Oct 4 locally.
    add.effectiveAt = "2026-10-05T08:30:00Z";
    expect(evaluatePlan(data, intent, "agp", [add]).legal).toBe(false); // Cost exceeds allowance.
    data.rules.periods[0].remaining = 2;
    expect(evaluatePlan(data, intent, "agp", [add]).legal).toBe(true);
  });
  it("does not let a drop invalidate an already locked future assignment", () => {
    const data = snapshot();
    data.lockedAssignments = [{ date: "2026-10-06", playerId: "a", slotId: "C#1" }];
    const add = { id: "add", type: "add" as const, playerId: "c", dropPlayerId: "a", at: "2026-10-05T00:00:00Z", effectiveAt: "2026-10-05T00:00:00Z", conditional: true, dependsOn: [] };
    expect(evaluatePlan(data, intent, "agp", [add]).legal).toBe(false);
  });
  it("preserves a locked bench player without promoting them", () => {
    const data = snapshot();
    data.lockedAssignments = [{ date: "2026-10-05", playerId: "b", slotId: null }];
    const result = evaluatePlan(data, intent, "agp");
    expect(result.legal).toBe(true);
    expect(result.assignments.some(row => row.date === "2026-10-05" && row.playerId === "b")).toBe(false);
  });
  it("does not treat an unknown start earlier today as a future opportunity", () => {
    const data = snapshot();
    data.context.asOf = "2026-10-05T18:00:00Z";
    data.games = data.games.map(game => game.date === "2026-10-05" ? { ...game, startsAt: null } : game);
    const result = evaluatePlan(data, intent, "agp");
    expect(result.assignments.every(row => row.date !== "2026-10-05")).toBe(true);
    expect(result.activeGames).toBe(1);
  });
  it.each([
    { startDate: "2026-10-05", asOf: "2026-10-05T21:00:00Z" },
    { startDate: "2026-10-06", asOf: "2026-10-04T00:00:00Z" },
  ])("preserves the custom $startDate horizon while including its last actionable day", ({ startDate, asOf }) => {
    const data = snapshot();
    data.context = { ...data.context, startDate, asOf };
    data.games.push({ ...data.games[0], id: "outside-horizon", date: "2026-10-07", startsAt: "2026-10-07T20:00:00Z" });
    const context = { ...data.context };
    const result = evaluatePlan(data, intent, "agp");
    expect(result.legal).toBe(true);
    expect(result.activeGames).toBe(1);
    // Today's games already under way keep their locked slots but are not remaining starts.
    expect(result.assignments.filter(row => !(row.date === "2026-10-05" && row.locked)).map(row => row.date)).toEqual(["2026-10-06"]);
    expect(data.context).toEqual(context);
  });
  it("maximizes weekly games rather than a player's single-game score", () => {
    const data = snapshot();
    data.rules.lineupMode = "weekly";
    data.rules.lineupPeriods = [{ id: "w", start: "2026-10-05T00:00:00Z", end: "2026-10-12T00:00:00Z", lockAt: "2026-10-05T00:00:00Z" }];
    data.games = data.games.filter(game => game.id !== "A1");
    data.forecasts = data.forecasts.filter(item => item.gameId !== "A1").map(item => item.playerId === "a" ? { ...item, stats: { pts: 100 } } : item);
    const result = evaluatePlan(data, intent, "agp");
    expect(result.assignments.map(row => row.playerId)).toEqual(["b", "b"]);
    data.forecasts = data.forecasts.map(row => ({ ...row, stats: { pts: row.playerId === "a" ? 10 : 6 } }));
    const quality = evaluatePlan(data, intent, "outcome");
    expect(quality.recommendation?.eligible).toBe(true);
    expect(quality.recommendation?.exclusions?.[0]).toMatchObject({ playerId: "a", value: 10, reason: "lower_lineup_value",
      evidence: { lineupMode: "weekly", startDate: "2026-10-05", endDate: "2026-10-06", selectedScore: 12, withPlayerScore: 10 } });
    expect(planRoster(data, intent, { maxSteps: 0 }).selected.recommendation?.exclusions?.[0]).toMatchObject({
      reason: "lower_lineup_value", evidence: { selectedScore: 12, withPlayerScore: 10 } });
    data.lockedAssignments = [{ date: "2026-10-06", playerId: "a", slotId: null }];
    expect(evaluatePlan(data, intent, "outcome").recommendation?.exclusions?.[0].reason).toBe("locked_bench");
  });
  it.each([
    { label: "retains the pre-drop game", first: 10, later: 10, other: 2, split: false, value: 10, selected: ["a"] },
    { label: "retains the pre-reserve game", first: 10, later: 10, other: 2, split: false, value: 10, selected: ["a"] },
    { label: "excludes games lost after a planned drop", first: 5, later: 100, other: 4, split: false, value: 8, selected: ["b", "b"] },
    { label: "admits the replacement only at the next lineup lock", first: 10, later: 10, other: 2, split: true, value: 13, selected: ["a", "c"] },
  ])("uses lock-time ownership and retained weekly opportunities: $label", scenario => {
    const data = snapshot();
    data.rules.lineupMode = "weekly";
    data.rules.lineupPeriods = [{ id: "w1", start: "2026-10-05T00:00:00Z",
      end: scenario.split ? "2026-10-06T00:00:00Z" : "2026-10-12T00:00:00Z", lockAt: "2026-10-05T00:00:00Z" }];
    if (scenario.split) data.rules.lineupPeriods.push({ id: "w2", start: "2026-10-06T00:00:00Z",
      end: "2026-10-12T00:00:00Z", lockAt: "2026-10-06T00:00:00Z" });
    data.games = data.games.filter(game => game.id !== "C0").map(game => ({ ...game,
      startsAt: game.teamAbbreviation === "B" ? `${game.date}T22:00:00Z` : game.startsAt }));
    data.forecasts = data.games.map(game => issuedForecast(data, game.teamAbbreviation.toLowerCase(), game.id,
      { stats: { pts: game.teamAbbreviation === "A" ? game.id === "A0" ? scenario.first : scenario.later
        : game.teamAbbreviation === "B" ? scenario.other : 3 } }));
    const move = { id: "later", type: "add" as const, playerId: "c", dropPlayerId: "a", at: "2026-10-05T21:00:00Z",
      effectiveAt: "2026-10-05T21:00:00Z", conditional: true, dependsOn: [] };
    const selectedIntent: PlanIntent = { ...intent, steps: [move] };
    if (scenario.label === "retains the pre-reserve game") {
      data.players[0].reserveEligibility = ["IR"];
      data.rules.rosterSlots.IR = 1;
      selectedIntent.steps = [{ id: "reserve", type: "reserve", playerId: "a", reservePosition: "IR", at: move.at,
        effectiveAt: move.effectiveAt, conditional: false, dependsOn: [] }, { ...move, dropPlayerId: undefined, dependsOn: ["reserve"] }];
    }
    const before = structuredClone(data);
    const result = evaluatePlan(data, selectedIntent, "outcome", undefined, false);
    expect(result).toMatchObject({ legal: true, comparisonEligible: true, budgetVerified: true,
      projectedValue: scenario.value, activeGames: scenario.selected.length, acquisitions: { p: 1 } });
    expect(result.assignments.map(row => row.playerId)).toEqual(scenario.selected);
    expect(result.steps).toEqual(selectedIntent.steps);
    expect(result.limitations.some(text => text.includes("Future availability for c must be rechecked"))).toBe(true);
    const explained = evaluatePlan(data, selectedIntent, "outcome");
    expect(explained).toMatchObject({ comparisonEligible: true, projectedValue: scenario.value, recommendation: { eligible: true } });
    if (!scenario.split) {
      const lockedOut = explained.recommendation?.exclusions?.find(row => row.playerId === "c");
      expect(lockedOut?.reason).toBe("weekly_lock");
      expect(lockedOut?.evidence).toBeUndefined();
    }
    if (scenario.label === "retains the pre-drop game") {
      expect(planRoster(data, selectedIntent, { maxSteps: 0 }).selected.recommendation?.eligible).toBe(true);
      const bounded = planRoster(data, selectedIntent, { maxSteps: 0, maxBenchEvaluations: 0 }).selected;
      expect(bounded.recommendation?.eligible).toBe(false);
      expect(bounded.recommendation?.exclusions?.find(row => row.playerId === "c")?.reason).toBe("weekly_lock");
      const missing = { ...data, forecasts: data.forecasts.filter(row => row.gameId !== "B0") };
      expect(evaluatePlan(missing, selectedIntent, "outcome").comparisonEligible).toBe(false);
      const unknownLock = { ...data, rules: { ...data.rules, lineupPeriods: data.rules.lineupPeriods.map(period => ({ ...period, lockAt: null })) } };
      const unknown = evaluatePlan(unknownLock, selectedIntent, "outcome");
      expect(unknown.recommendation?.eligible).toBe(false);
      expect(unknown.recommendation?.exclusions?.every(row => row.reason !== "weekly_lock")).toBe(true);
    }
    expect(data).toEqual(before);
  });
  it("reports unavailable outcome with no usable forecasts and retains AGP baseline", () => {
    const data = snapshot();
    data.forecasts = [];
    const result = planRoster(data, intent, { maxSteps: 0 });
    expect(result.noMoveOutcome.projectedValue).toBeNull();
    expect(result.baseline.objective).toBe("agp");
    expect(result.noMoveAgp.activeGames).toBe(2);
  });
  it("scores skater and goalie fields only where their class applies", () => {
    const data = snapshot();
    const goalie = { ...player("g", "G"), eligiblePositions: ["G"], playerClass: "goalie" as const };
    data.players = [data.players[0], goalie];
    data.roster = [{ playerId: "a", position: "active" }, { playerId: "g", position: "active" }];
    data.rules.rosterSlots = { C: 1, G: 1 };
    data.games = [data.games[0], { ...data.games[0], id: "G0", teamAbbreviation: "G" }];
    data.forecasts = [
      { ...data.forecasts[0], stats: { pts: 2 } },
      issuedForecast(data, "g", "G0", { stats: { saves: 30 }, startProbability: 0.8 }),
    ];
    data.rules.scoring.weights = { pts: 1, saves: 0.1 };
    data.realized = { pts: 0, saves: 0 };
    const result = evaluatePlan(data, intent, "outcome");
    expect(result.activeGames).toBe(2);
    expect(result.projectedValue).toBe(5);
  });
  it("lets outcome-first assignment sit a harmful ratio appearance", () => {
    const data = snapshot();
    const goalie = { ...player("g", "G"), eligiblePositions: ["G"], playerClass: "goalie" as const };
    data.players = [goalie];
    data.roster = [{ playerId: "g", position: "active" }];
    data.games = [{ ...data.games[0], id: "G0", teamAbbreviation: "G" }];
    data.forecasts = [issuedForecast(data, "g", "G0", { stats: { goalsAgainst: 5, minutes: 10 }, startProbability: 0.8 })];
    data.rules.rosterSlots = { G: 1 };
    data.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "gaa", direction: "lower", numerator: "goalsAgainst", denominator: "minutes" }] };
    data.realized = { goalsAgainst: 1, minutes: 10 };
    data.opponent = { roster: [], realized: { goalsAgainst: 1, minutes: 10 }, remaining: { goalsAgainst: 0, minutes: 0 } };
    expect(evaluatePlan(data, intent, "agp").activeGames).toBe(1);
    expect(evaluatePlan(data, intent, "outcome").activeGames).toBe(0);
  });
  it("supports successive occupants and keeps each acquisition in its period", () => {
    const data = snapshot();
    data.players.push(player("d", "D", "free_agent"));
    data.games.push({ ...data.games[0], id: "D1", date: "2026-10-06", startsAt: "2026-10-06T20:00:00Z", teamAbbreviation: "D" });
    data.forecasts.push(issuedForecast(data, "d", "D1", { stats: { pts: 3 } }));
    data.rules.periods = [
      { id: "first", start: "2026-10-04T00:00:00Z", end: "2026-10-06T00:00:00Z", remaining: 1, source: "manager" },
      { id: "second", start: "2026-10-06T00:00:00Z", end: "2026-10-12T00:00:00Z", remaining: 1, source: "manager" },
    ];
    const first = { id: "first-add", type: "add" as const, playerId: "c", dropPlayerId: "b", at: "2026-10-05T00:00:00Z", effectiveAt: "2026-10-05T00:00:00Z", conditional: true, dependsOn: [] };
    const second = { id: "second-add", type: "add" as const, playerId: "d", dropPlayerId: "c", at: "2026-10-06T00:00:00Z", effectiveAt: "2026-10-06T00:00:00Z", conditional: true, dependsOn: [first.id] };
    const result = evaluatePlan(data, intent, "outcome", [first, second]);
    expect(result.legal).toBe(true);
    expect(result.acquisitions).toEqual({ first: 1, second: 1 });
    expect(result.assignments.map(row => row.playerId)).toEqual(["c", "d"]);
  });
  it("finds the tiny exhaustive two-add oracle while reporting search coverage", () => {
    const data = snapshot();
    data.rules.rosterSlots = { C: 1, BN: 3 };
    data.players.push(player("d", "D", "free_agent"));
    data.games.push({ ...data.games[0], id: "D1", date: "2026-10-06", startsAt: "2026-10-06T20:00:00Z", teamAbbreviation: "D" });
    data.forecasts.push(issuedForecast(data, "d", "D1", { stats: { pts: 4 } }));
    const moves = ["c", "d"].map(id => ({ id, type: "add" as const, playerId: id, at: "2026-10-05T00:00:00Z", effectiveAt: "2026-10-05T00:00:00Z", conditional: true, dependsOn: [] }));
    const oracle = [[], [moves[0]], [moves[1]], moves].map(steps => evaluatePlan(data, intent, "outcome", steps)).filter(item => item.legal).reduce((best, item) => Math.max(best, item.projectedValue ?? -Infinity), -Infinity);
    const result = planRoster(data, intent, { maxEvaluations: 500, beamWidth: 20, maxCandidates: 2, maxSteps: 2, timeBudgetMs: 10000 });
    expect(result.search.evaluated).toBeGreaterThan(3);
    expect(result.alternatives[1].projectedValue).toBe(oracle);
  });
  it("rejects a dependent action placed before its prerequisite action", () => {
    const data = snapshot();
    data.players[1].reserveEligibility = ["IR"];
    data.rules.rosterSlots.IR = 1;
    const reserve = { id: "reserve", type: "reserve" as const, playerId: "b", reservePosition: "IR" as const, at: "2026-10-05T12:00:00Z", effectiveAt: "2026-10-05T12:00:00Z", conditional: false, dependsOn: [] };
    const add = { id: "add", type: "add" as const, playerId: "c", at: "2026-10-05T11:00:00Z", effectiveAt: "2026-10-05T13:00:00Z", conditional: true, dependsOn: [reserve.id] };
    expect(evaluatePlan(data, intent, "agp", [reserve, add]).legal).toBe(false);
  });
  it("requires conditional future availability and does not infer appearance odds from starts", () => {
    const data = snapshot();
    const add = { id: "add", type: "add" as const, playerId: "c", dropPlayerId: "b", at: "2026-10-05T00:00:00Z", effectiveAt: "2026-10-05T00:00:00Z", conditional: false, dependsOn: [] };
    expect(evaluatePlan(data, intent, "agp", [add]).legal).toBe(false);
    add.conditional = true;
    expect(evaluatePlan(data, intent, "agp", [add]).legal).toBe(true);
    data.rules.goalieMinimum = { required: 1, credited: 0, counts: "appearances", penalty: "none", periodStart: "2026-10-05", periodEnd: "2026-10-07" };
    const result = evaluatePlan(data, intent, "agp");
    expect(result.goalie.projected).toBeNull();
    expect(result.goalie.risk).toBe(true);
  });
  it("ignores zero-weight fields and does not assume unknown opponent remaining is zero", () => {
    const data = snapshot();
    data.rules.scoring.weights = { pts: 1, unused: 0 };
    expect(evaluatePlan(data, intent, "outcome").projectedValue).toBe(4);
    data.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "pts", direction: "higher" }] };
    data.opponent = { roster: [], realized: { pts: 1 }, remaining: null };
    expect(evaluatePlan(data, intent, "outcome").categoryResults[0].result).toBe("unknown");
  });
  it("keeps the successful prefix if a later conditional claim fails", () => {
    const data = snapshot();
    data.players.push({ ...player("d", "D", "waivers"), waiverClearsAt: "2026-10-06T00:00:00Z" });
    const first = { id: "first", type: "add" as const, playerId: "c", dropPlayerId: "b", at: "2026-10-05T00:00:00Z", effectiveAt: "2026-10-05T00:00:00Z", conditional: true, dependsOn: [] };
    const second = { id: "second", type: "add" as const, playerId: "d", dropPlayerId: "c", at: "2026-10-06T00:00:00Z", effectiveAt: "2026-10-06T00:00:00Z", conditional: true, dependsOn: [first.id] };
    const result = planRoster(data, { ...intent, steps: [first, second] }, { maxSteps: 0 });
    expect(result.noClaimContinuations?.find(item => item.claimStepId === "second")?.evaluation.steps).toEqual([first]);
  });
  it.each(["missing-period", "exhausted-budget", "roster-capacity"] as const)("retains the roster prefix when a conditional suffix fails %s validation", failure => {
    const data = snapshot();
    data.players.push(player("d", "D", "free_agent"));
    data.games.push({ ...data.games[0], id: "D1", date: "2026-10-06", startsAt: "2026-10-06T20:00:00Z", teamAbbreviation: "D" });
    data.forecasts.push(issuedForecast(data, "d", "D1", { stats: { pts: 10 } }));
    const first = { id: "first", type: "add" as const, playerId: "c", dropPlayerId: "b", at: "2026-10-05T00:00:00Z", effectiveAt: "2026-10-05T00:00:00Z", conditional: true, dependsOn: [] };
    const second = { id: "second", type: "add" as const, playerId: "d", dropPlayerId: failure === "roster-capacity" ? undefined : "c", at: "2026-10-06T00:00:00Z", effectiveAt: "2026-10-06T00:00:00Z", conditional: true, dependsOn: [first.id] };
    if (failure === "missing-period") data.rules.periods[0].end = second.at;
    if (failure === "exhausted-budget") data.rules.periods[0].remaining = 1;
    const selected = { ...intent, steps: [first, second] };
    const before = JSON.stringify({ data, selected });
    const timeline = buildTimeline(data, selected, selected.steps);
    expect([...timeline.at(first.effectiveAt).keys()]).toEqual(["a", "c"]);
    expect([...timeline.at(second.effectiveAt).keys()]).toEqual(["a", "c"]);
    expect(timeline.legal).toBe(false);
    expect(timeline.acquisitions).toEqual({ p: 1 });
    const evaluation = evaluatePlan(data, selected, "outcome");
    expect(evaluation.assignments.map(row => row.playerId)).toEqual(["c", "c"]);
    expect(evaluation.legal).toBe(false);
    expect(evaluation.recommendation?.eligible).toBe(false);
    expect(JSON.stringify({ data, selected })).toBe(before);
  });
  it("does not let a rejected reserve prerequisite create capacity for its dependent add", () => {
    const data = snapshot();
    data.players[1].reserveEligibility = ["IR"];
    data.rules.rosterSlots.IR = 0;
    const reserve = { id: "reserve", type: "reserve" as const, playerId: "b", reservePosition: "IR" as const, at: "2026-10-05T00:00:00Z", effectiveAt: "2026-10-05T00:00:00Z", conditional: false, dependsOn: [] };
    const add = { id: "add", type: "add" as const, playerId: "c", at: reserve.at, effectiveAt: reserve.effectiveAt, conditional: true, dependsOn: [reserve.id] };
    const timeline = buildTimeline(data, intent, [reserve, add]);
    const roster = timeline.at(add.effectiveAt);
    expect([...roster.keys()]).toEqual(["a", "b"]);
    expect(roster.get("b")?.position).toBe("bench");
    expect(timeline.acquisitions).toEqual({});
    expect(timeline.legal).toBe(false);
    expect(timeline.limitations).toContain("IR capacity exceeded.");
    expect(timeline.limitations).toContain("Unmet or mistimed dependency for add.");
  });
  it("does not spend waiver budget for a rejected move before evaluating an independent claim", () => {
    const data = snapshot();
    data.rules.waivers = { mode: "budget", remainingBudget: 5 };
    data.players.push(...["d", "e"].map(id => ({ ...player(id, id.toUpperCase(), "waivers"), waiverClearsAt: "2026-10-06T00:00:00Z" })));
    const rejected = { id: "first", type: "add" as const, playerId: "d", dropPlayerId: "b", at: "2026-10-05T00:00:00Z", effectiveAt: "2026-10-06T00:00:00Z", waiverSpend: 3, conditional: true, dependsOn: [] };
    const independent = { ...rejected, id: "second", playerId: "e", dropPlayerId: "a" };
    const timeline = buildTimeline(data, { ...intent, protectedPlayerIds: ["b"] }, [rejected, independent]);
    expect([...timeline.at(independent.effectiveAt).keys()]).toEqual(["b", "e"]);
    expect(timeline.acquisitions).toEqual({ p: 1 });
    expect(timeline.legal).toBe(false);
    expect(timeline.budgetVerified).toBe(true);
    expect(timeline.limitations).toContain("Invalid drop prerequisite for first.");
    expect(timeline.limitations).not.toContain("Waiver budget exceeded.");
  });
  it("rejects invalid timestamps and locked bench occupancy changes", () => {
    const data = snapshot();
    data.lockedAssignments = [{ date: "2026-10-05", playerId: "b", slotId: null }];
    const drop = { id: "drop", type: "drop" as const, playerId: "b", at: "2026-10-05T00:00:00Z", effectiveAt: "2026-10-05T00:00:00Z", conditional: false, dependsOn: [] };
    expect(evaluatePlan(data, intent, "agp", [drop]).legal).toBe(false);
    expect(evaluatePlan(data, intent, "agp", [{ ...drop, at: "invalid", effectiveAt: "invalid" }]).legal).toBe(false);
  });
  it("does not certify acquisition timing when the league rule is unknown", () => {
    const data = snapshot();
    data.rules.acquisitionTiming = "unknown";
    const add = { id: "add", type: "add" as const, playerId: "c", dropPlayerId: "b", at: "2026-10-05T00:00:00Z", effectiveAt: "2026-10-05T00:00:00Z", conditional: true, dependsOn: [] };
    expect(evaluatePlan(data, intent, "agp", [add]).legal).toBe(false);
  });
  it("keeps surplus-goal versus hit gains descriptive without a category-win utility", () => {
    const data = snapshot();
    data.games = data.games.filter(game => game.date === "2026-10-05" && game.teamAbbreviation !== "C");
    data.forecasts = [
      { ...data.forecasts[0], playerId: "a", gameId: "A0", stats: { g: 100, h: 0, unused: null } },
      issuedForecast(data, "b", "B0", { stats: { g: 0, h: 2, unused: null } }),
    ];
    data.context.endDate = "2026-10-05";
    data.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "g", direction: "higher" }, { key: "h", direction: "higher" }] };
    data.realized = { g: 100, h: 0 };
    data.opponent = { roster: [], realized: { g: 0, h: 1 }, remaining: { g: 0, h: 0 } };
    const result = evaluatePlan(data, intent, "outcome");
    expect(result.assignments.map(row => row.playerId)).toEqual(["a"]);
    expect(result.categoryResults).toMatchObject([{ key: "g", own: 200, result: "win" }, { key: "h", own: 0, result: "loss" }]);
    expect(result.recommendation?.eligible).toBe(false);
    expect(result.recommendation?.exclusions?.[0]).toMatchObject({ playerId: "b", reason: "unresolved_quality" });
    expect(result.recommendation?.exclusions?.[0].evidence).toBeUndefined();
  });
  it("sits a ratio appearance that gains surplus saves but loses a second category", () => {
    const data = snapshot();
    const goalie = { ...player("g", "G"), eligiblePositions: ["G"], playerClass: "goalie" as const };
    data.players = [goalie]; data.roster = [{ playerId: "g", position: "active" }];
    data.games = [{ ...data.games[0], id: "G0", teamAbbreviation: "G" }];
    data.forecasts = [issuedForecast(data, "g", "G0", { stats: { saves: 85, shotsAgainst: 100, goalsAgainst: 2 }, startProbability: 0.8 })];
    data.rules.rosterSlots = { G: 1 };
    data.rules.scoring = { mode: "categories", weights: {}, categories: [
      { key: "savePct", direction: "higher", numerator: "saves", denominator: "shotsAgainst" },
      { key: "goalsAgainst", direction: "lower" },
    ] };
    data.realized = { saves: 9, shotsAgainst: 10, goalsAgainst: 0 };
    data.opponent = { roster: [], realized: { saves: 8, shotsAgainst: 10, goalsAgainst: 1 }, remaining: { saves: 0, shotsAgainst: 0, goalsAgainst: 0 } };
    expect(evaluatePlan(data, intent, "agp").activeGames).toBe(1);
    const result = evaluatePlan(data, intent, "outcome");
    expect(result.activeGames).toBe(0);
    expect(result.categoryResults.map(row => row.result)).toEqual(["win", "win"]);
    expect(result.categoryResults.map(row => row.own)).toEqual([0.9, 0]);
    expect(result.recommendation?.eligible).toBe(false);
    expect(result.recommendation?.exclusions?.[0]).toMatchObject({ reason: "unresolved_quality" });
    expect(result.recommendation?.exclusions?.[0].evidence).toBeUndefined();
  });
  it("keeps a neutral weekly category occupant fixed when alternatives trade category gains", () => {
    const data = snapshot();
    data.rules.lineupMode = "weekly";
    data.rules.lineupPeriods = [{ id: "w", start: "2026-10-05T00:00:00Z", end: "2026-10-12T00:00:00Z", lockAt: "2026-10-05T00:00:00Z" }];
    data.forecasts = data.forecasts.map(item => ({ ...item, stats: item.playerId === "a" ? { g: 100, h: 0 } : { g: 0, h: 2 } }));
    data.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "g", direction: "higher" }, { key: "h", direction: "higher" }] };
    data.realized = { g: 100, h: 0 };
    data.opponent = { roster: [], realized: { g: 0, h: 1 }, remaining: { g: 0, h: 0 } };
    const result = evaluatePlan(data, intent, "outcome");
    expect(result.assignments.map(row => row.playerId)).toEqual(["a", "a"]);
    const locked = evaluatePlan({ ...data, lockedAssignments: [{ date: "2026-10-06", playerId: "b", slotId: "C#1" }] }, intent, "outcome");
    expect(locked.assignments.map(row => row.playerId)).toEqual(["b", "b"]);
  });
  it("does not recommend a costed tie move", () => {
    const data = snapshot();
    const result = planRoster(data, intent, { maxEvaluations: 150, maxCandidates: 1, maxSteps: 1 });
    expect(result.alternatives).toHaveLength(1);
    expect(result.alternatives[0].steps).toEqual([]);
  });
  it("requires verified waiver budget evidence without inventing a bid", () => {
    const data = snapshot();
    data.players[2].availability = "waivers";
    data.players[2].waiverClearsAt = "2026-10-05T00:00:00Z";
    const claim = { id: "claim", type: "add" as const, playerId: "c", dropPlayerId: "b", at: "2026-10-05T00:00:00Z", effectiveAt: "2026-10-05T00:00:00Z", conditional: true, dependsOn: [] };
    expect(evaluatePlan(data, intent, "agp", [claim]).budgetVerified).toBe(false);
    data.rules.waivers = { mode: "budget", remainingBudget: 5 };
    expect(evaluatePlan(data, intent, "agp", [claim]).budgetVerified).toBe(false);
    expect(evaluatePlan(data, intent, "agp", [{ ...claim, waiverSpend: 3 }]).budgetVerified).toBe(true);
    expect(evaluatePlan(data, intent, "agp", [{ ...claim, waiverSpend: 6 }]).legal).toBe(false);
    expect(evaluatePlan(data, intent, "agp", [{ ...claim, waiverSpend: -1 }]).legal).toBe(false);
    data.rules.waivers = { mode: "priority", remainingBudget: null };
    expect(evaluatePlan(data, intent, "agp", [claim]).budgetVerified).toBe(true);
    data.players[2].waiverClearsAt = "not-a-time";
    expect(evaluatePlan(data, intent, "agp", [claim]).legal).toBe(false);
  });
  it("finds the two-slot two-step exhaustive sequence winner deterministically", () => {
    const data = snapshot();
    data.players[1].eligiblePositions = ["LW"];
    data.players[2].eligiblePositions = ["C"];
    data.players.push({ ...player("d", "D", "free_agent"), eligiblePositions: ["LW"] });
    data.rules.rosterSlots = { C: 1, LW: 1 };
    data.games = [
      { ...data.games[0], id: "A0", date: "2026-10-05", teamAbbreviation: "A" },
      { ...data.games[0], id: "D0", date: "2026-10-05", teamAbbreviation: "D" },
      { ...data.games[0], id: "B1", date: "2026-10-06", startsAt: "2026-10-06T20:00:00Z", teamAbbreviation: "B" },
      { ...data.games[0], id: "C1", date: "2026-10-06", startsAt: "2026-10-06T20:00:00Z", teamAbbreviation: "C" },
    ];
    data.forecasts = data.games.map(game => issuedForecast(data, game.teamAbbreviation.toLowerCase(), game.id,
      { stats: { pts: ["c", "d"].includes(game.teamAbbreviation.toLowerCase()) ? 3 : 1 } }));
    const d = { id: "d", type: "add" as const, playerId: "d", dropPlayerId: "b", at: "2026-10-05T00:00:00Z", effectiveAt: "2026-10-05T00:00:00Z", conditional: true, dependsOn: [] };
    const c = { id: "c", type: "add" as const, playerId: "c", dropPlayerId: "a", at: "2026-10-06T00:00:00Z", effectiveAt: "2026-10-06T00:00:00Z", conditional: true, dependsOn: [d.id] };
    const oracle = [[], [d], [{ ...c, dependsOn: [] }], [d, c]]
      .map(steps => evaluatePlan(data, intent, "outcome", steps))
      .filter(item => item.legal && item.budgetVerified)
      .reduce((best, item) => Math.max(best, item.projectedValue ?? -Infinity), -Infinity);
    const options = { maxEvaluations: 1000, maxCandidates: 2, beamWidth: 50, maxSteps: 2, timeBudgetMs: 10000 };
    const first = planRoster(data, intent, options), second = planRoster(data, intent, options);
    expect(oracle).toBe(7);
    expect(Math.max(...first.alternatives.map(item => item.projectedValue ?? -Infinity))).toBe(oracle);
    expect(first.alternatives.map(item => item.steps.map(step => step.playerId))).toEqual(second.alternatives.map(item => item.steps.map(step => step.playerId)));
  });
  it("plans a Sunday action for a Monday next-day acquisition", () => {
    const data = snapshot();
    data.rules.acquisitionTiming = "next_day";
    data.rules.periods = [
      { id: "submission-week", start: "2026-09-28T00:00:00Z", end: "2026-10-05T00:00:00Z", remaining: 1, source: "manager" },
      { id: "effective-week", start: "2026-10-05T00:00:00Z", end: "2026-10-12T00:00:00Z", remaining: 0, source: "manager" },
    ];
    data.forecasts = data.forecasts.map(item => item.playerId === "c" ? { ...item, stats: { pts: 3 } } : item);
    const result = planRoster(data, intent, { maxEvaluations: 100, maxCandidates: 1, maxSteps: 1 });
    const add = result.alternatives.flatMap(item => item.steps).find(step => step.type === "add" && step.playerId === "c");
    expect(add?.at.slice(0, 10)).toBe("2026-10-04");
    expect(add?.effectiveAt.slice(0, 10)).toBe("2026-10-05");
    const selected = evaluatePlan(data, intent, "agp", [add!]);
    expect(selected.legal).toBe(true);
    expect(selected.budgetVerified).toBe(true);
    expect(selected.acquisitions).toEqual({ "submission-week": 1 });
    data.rules.periods[0].remaining = 0;
    data.rules.periods[1].remaining = 1;
    expect(evaluatePlan(data, intent, "agp", [add!]).legal).toBe(false);
    data.rules.periods[0].remaining = null;
    const unknown = evaluatePlan(data, intent, "agp", [add!]);
    expect(unknown.legal).toBe(true);
    expect(unknown.budgetVerified).toBe(false);
    expect(unknown.acquisitions).toEqual({ "submission-week": 1 });
    expect(unknown.limitations).toContain("Acquisition allowance or counting cost for submission-week is unverified.");
    const alternatives = planRoster(data, intent, { maxEvaluations: 100, maxCandidates: 1, maxSteps: 1 }).alternatives;
    expect(alternatives.every(plan => plan.steps.every(step => !step.at.startsWith("2026-10-04")))).toBe(true);
    expect(alternatives.every(plan => plan.budgetVerified)).toBe(true);
  });
  it("keeps AGP lexicographic when a two-game player has very negative projected value", () => {
    const data = snapshot();
    data.rules.lineupMode = "weekly";
    data.rules.lineupPeriods = [{ id: "w", start: "2026-10-05T00:00:00Z", end: "2026-10-12T00:00:00Z", lockAt: "2026-10-05T00:00:00Z" }];
    data.games = data.games.filter(game => game.teamAbbreviation !== "C" && game.id !== "A1");
    data.forecasts = data.forecasts.filter(item => item.gameId !== "A1").map(item => ({ ...item, stats: { pts: item.playerId === "a" ? 1e9 : -1e9 } }));
    const result = evaluatePlan(data, intent, "agp");
    expect(result.assignments.map(row => row.playerId)).toEqual(["b", "b"]);
  });
  it("reaches multiple acquisitions within the bounded 25/300/7/4 workload", () => {
    const data = snapshot();
    const teams = Array.from({ length: 10 }, (_, index) => `T${index}`);
    data.players = Array.from({ length: 325 }, (_, index) => ({ ...player(`p${index}`, teams[index % 10], index < 25 ? "rostered" : "free_agent"), eligiblePositions: ["C"] }));
    data.roster = data.players.slice(0, 25).map(item => ({ playerId: item.id, position: "bench" }));
    data.rules.rosterSlots = { C: 10, BN: 15 };
    data.context.endDate = "2026-10-11";
    const dates = Array.from({ length: 7 }, (_, index) => new Date(Date.UTC(2026, 9, 5 + index)).toISOString().slice(0, 10));
    data.games = dates.flatMap(date => teams.map(team => ({ id: `${team}:${date}`, scheduleRevision: `schedule-${team}-${date}`, date, startsAt: `${date}T20:00:00Z`, teamAbbreviation: team, opponent: "X", home: true, status: "scheduled" as const })));
    data.forecasts = data.players.flatMap(item => dates.map(date => issuedForecast(data, item.id, `${item.teamAbbreviation}:${date}`, { stats: { pts: item.availability === "rostered" ? 1 : 5 } })));
    data.rules.periods = [
      { id: "p1", start: "2026-10-04T00:00:00Z", end: "2026-10-06T00:00:00Z", remaining: 4, source: "manager" },
      { id: "p2", start: "2026-10-06T00:00:00Z", end: "2026-10-08T00:00:00Z", remaining: 4, source: "manager" },
      { id: "p3", start: "2026-10-08T00:00:00Z", end: "2026-10-10T00:00:00Z", remaining: 4, source: "manager" },
      { id: "p4", start: "2026-10-10T00:00:00Z", end: "2026-10-12T00:00:00Z", remaining: 4, source: "manager" },
    ];
    const noAcquisitions = planRoster(data, intent, { maxSteps: 0 });
    expect(noAcquisitions.selected.recommendation?.eligible).toBe(true);
    expect(noAcquisitions.selected.recommendation?.explanationStatus).toBe("complete");
    expect(noAcquisitions.search.benchEvidence?.complete).toBe(true);
    expect(noAcquisitions.selected.recommendation?.exclusions).toHaveLength(105);
    const result = planRoster(data, intent, { maxEvaluations: 250, maxCandidates: 40, beamWidth: 8, maxSteps: 4 });
    expect(result.search.maxDepthReached).toBeGreaterThanOrEqual(2);
    expect(result.search.complete).toBe(false);
  }, 30000);
  it("keeps a credited goalie minimum satisfied when future start odds are missing", () => {
    const data = snapshot();
    const goalie = { ...player("g", "G"), eligiblePositions: ["G"], playerClass: "goalie" as const };
    data.players = [goalie]; data.roster = [{ playerId: "g", position: "active" }];
    data.games = [{ ...data.games[0], id: "G0", teamAbbreviation: "G" }];
    data.forecasts = [issuedForecast(data, "g", "G0", { stats: { saves: 10 }, startProbability: null })];
    data.rules.rosterSlots = { G: 1 };
    data.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "saves", direction: "higher" }] };
    data.realized = { saves: 0 };
    data.opponent = { roster: [], realized: { saves: 0 }, remaining: { saves: 0 } };
    data.rules.goalieMinimum = { required: 1, credited: 1, counts: "starts", penalty: "lose_goalie_categories", periodStart: "2026-10-05", periodEnd: "2026-10-07" };
    const result = evaluatePlan(data, intent, "agp");
    expect(result.goalie.projected).toBe(1);
    expect(result.goalie.risk).toBe(false);
    expect(result.projectedValue).toBe(1);
    data.rules.goalieMinimum.counts = "appearances";
    const appearance = evaluatePlan(data, intent, "agp");
    expect(appearance.goalie.projected).toBe(1);
    expect(appearance.goalie.risk).toBe(false);
  });
  it("treats Thursday as early for Mon–Thu and late for Mon–Wed", () => {
    const data = snapshot();
    const goalie = { ...player("g", "G"), eligiblePositions: ["G"], playerClass: "goalie" as const };
    data.players = [goalie]; data.roster = [{ playerId: "g", position: "active" }];
    data.games = [{ ...data.games[0], id: "G3", date: "2026-10-08", startsAt: "2026-10-08T20:00:00Z", teamAbbreviation: "G" }];
    data.context.endDate = "2026-10-08";
    data.forecasts = [issuedForecast(data, "g", "G3", { stats: { saves: 10 }, startProbability: 1 })];
    data.rules.rosterSlots = { G: 1 };
    data.rules.scoring.weights = { saves: 1 }; data.realized = { saves: 0 };
    data.rules.goalieMinimum = { required: 1, credited: 0, counts: "starts", penalty: "none", periodStart: "2026-10-05", periodEnd: "2026-10-09" };
    const covers = (goalieWindow: "early" | "late", goalieSplit: "mon_thu" | "mon_wed") =>
      evaluatePlan(data, { ...intent, goalieCoverage: "cover", goalieWindow, goalieSplit }, "outcome").limitations.some(value => value.includes("Preferred goalie coverage window has no verified usable start"));
    expect(covers("early", "mon_thu")).toBe(false);
    expect(covers("early", "mon_wed")).toBe(true);
    expect(covers("late", "mon_thu")).toBe(true);
    expect(covers("late", "mon_wed")).toBe(false);
  });
  it("reports an impossible preferred window without spending an exhausted acquisition budget", () => {
    const data = snapshot();
    const goalie = { ...player("g", "G", "free_agent"), eligiblePositions: ["G"], playerClass: "goalie" as const };
    data.players.push(goalie);
    data.games = [{ ...data.games[0], id: "G3", date: "2026-10-08", startsAt: "2026-10-08T20:00:00Z", teamAbbreviation: "G" }];
    data.context.endDate = "2026-10-08";
    data.forecasts = [issuedForecast(data, "g", "G3", { stats: { saves: 10 }, startProbability: 1 })];
    data.rules.rosterSlots = { C: 1, G: 1, BN: 1 };
    data.rules.scoring.weights = { saves: 1 }; data.realized = { saves: 0 };
    data.rules.goalieMinimum = { required: 1, credited: 0, counts: "starts", penalty: "none", periodStart: "2026-10-05", periodEnd: "2026-10-09" };
    data.rules.periods[0].remaining = 0;
    const coverIntent = { ...intent, goalieCoverage: "cover" as const, goalieWindow: "early" as const, goalieSplit: "mon_wed" as const };
    const result = planRoster(data, coverIntent, { maxCandidates: 1, maxSteps: 1 });
    expect(result.alternatives.every(item => item.steps.length === 0)).toBe(true);
    expect(result.baseline.goalie.risk).toBe(true);
    expect(result.baseline.limitations.some(value => value.includes("coverage is infeasible"))).toBe(true);
  });
  it("withholds overfull goalie competition rather than capping it into readiness", () => {
    const data = snapshot();
    const goalies = ["g1", "g2"].map(id => ({ ...player(id, "G"), eligiblePositions: ["G"], playerClass: "goalie" as const }));
    data.players = goalies; data.roster = goalies.map(item => ({ playerId: item.id, position: "active" }));
    data.games = [{ ...data.games[0], id: "G0", teamAbbreviation: "G" }];
    data.forecasts = goalies.map(item => issuedForecast(data, item.id, "G0", { stats: { saves: 10 }, startProbability: 0.8 }));
    data.rules.rosterSlots = { G: 2 };
    data.rules.scoring.weights = { saves: 1 }; data.realized = { saves: 0 };
    data.rules.goalieMinimum = { required: 2, credited: 0, counts: "starts", penalty: "none", periodStart: "2026-10-05", periodEnd: "2026-10-07" };
    expect(snapshotSchema.safeParse(data).success).toBe(true);
    for (const forecasts of [data.forecasts, [...data.forecasts].reverse()]) {
      const result = evaluatePlan({ ...data, forecasts }, intent, "outcome");
      expect(result.activeGames).toBe(2);
      expect(result.goalie.projected).toBeNull();
      expect(result.goalie.risk).toBe(true);
      expect(result.recommendation?.eligible).toBe(false);
      expect(result.comparisonEligible).toBe(false);
      expect(result.projectedValue).toBeNull();
      expect(result.recommendation?.coverage?.exclusions.every(row => row.reasons.includes("unsupported_conditioning"))).toBe(true);
    }
  });
  it("does not auto-reserve for accepted goalie risk with negative outcome", () => {
    const data = snapshot();
    const goalie = { ...player("g", "G", "free_agent"), eligiblePositions: ["G"], playerClass: "goalie" as const };
    data.players.push(goalie); data.players[1].reserveEligibility = ["IR"];
    data.rules.rosterSlots = { C: 1, G: 1, BN: 1, IR: 1 };
    data.games = [{ ...data.games[0], id: "G0", teamAbbreviation: "G" }];
    data.forecasts = [issuedForecast(data, "g", "G0", { stats: { saves: -10 }, startProbability: 1 })];
    data.rules.scoring.weights = { saves: 1 }; data.realized = { saves: 0 };
    data.rules.goalieMinimum = { required: 1, credited: 0, counts: "starts", penalty: "none", periodStart: "2026-10-05", periodEnd: "2026-10-07" };
    const result = planRoster(data, { ...intent, protectedPlayerIds: ["a", "b"] }, { maxCandidates: 1, maxSteps: 1 });
    expect(result.alternatives.every(item => item.steps.length === 0)).toBe(true);
    expect(result.baseline.goalie.risk).toBe(true);
  });
  it.each([1, 1e-9, 1e-15])("preserves distinct goalie lineup gains at a league points scale of %s", weight => {
    const data = snapshot();
    data.players = data.players.filter(row => row.id !== "c").map(row => ({ ...row, eligiblePositions: ["G"], playerClass: "goalie" as const }));
    data.roster = data.players.map(row => ({ playerId: row.id, position: "active" }));
    data.games = data.games.filter(game => game.teamAbbreviation !== "C");
    data.rules.rosterSlots = { G: 1, BN: 1 };
    data.rules.scoring.weights = { saves: weight };
    data.rules.goalieMinimum = { required: 1, credited: 0, counts: "starts", penalty: "none", periodStart: "2026-10-05", periodEnd: "2026-10-07" };
    data.realized = {};
    data.forecasts = data.games.map(game => {
      const member = data.players.find(row => row.teamAbbreviation === game.teamAbbreviation)!;
      return issuedForecast(data, member.id, game.id, { stats: { saves: member.id === "a" ? 1 : game.date === "2026-10-05" ? 3 : 2 },
        startProbability: member.id === "a" ? 1 : 0.25, confirmedStart: member.id === "a" });
    });
    const manager = { ...intent, goalieCoverage: "cover" as const };
    for (const result of [evaluatePlan(data, manager, "outcome"), planRoster(data, manager, { maxSteps: 0 }).selected]) {
      expect(result.assignments.map(row => `${row.date}:${row.playerId}`).sort()).toEqual(["2026-10-05:b", "2026-10-06:a"]);
      expect(result.projectedValue).toBe(4 * weight);
      expect(result.goalie).toMatchObject({ credited: 0, projected: 1.25, risk: false, minimumSatisfied: false });
      expect(result.comparisonEligible).toBe(true);
      expect(result.recommendation?.eligible).toBe(true);
      for (const row of result.recommendation!.exclusions!) {
        if (row.evidence) expect(row.evidence.withPlayerScore).toBeLessThanOrEqual(row.evidence.selectedScore);
      }
    }
  });
  it.each([
    { a: 1, b: 2, reason: "lower_lineup_value" },
    { a: 0, b: 1, reason: "lower_lineup_value" },
    { a: -1, b: 0, reason: "negative_value" },
    { a: 1, b: 1, reason: "equal_lineup_value" },
  ])("distinguishes tiny bench outcomes from exact ties: $reason ($a, $b)", ({ a, b, reason }) => {
    const data = snapshot();
    data.context.endDate = data.context.startDate;
    data.games = data.games.filter(game => game.date === data.context.startDate);
    data.rules.scoring.weights = { pts: 1e-9 };
    data.forecasts = data.forecasts.filter(row => data.games.some(game => game.id === row.gameId))
      .map(row => ({ ...row, stats: { pts: row.playerId === "a" ? a : b } }));
    const result = evaluatePlan(data, intent, "outcome");
    expect(result.recommendation?.eligible).toBe(true);
    expect(result.recommendation?.exclusions).toContainEqual(expect.objectContaining({ reason }));
  });
  it("prioritizes projected goalie-minimum coverage before points without crediting future starts", () => {
    const data = snapshot();
    data.players = ["a", "b"].map((id, index) => ({ ...player(id, index ? "B" : "A"), eligiblePositions: ["G"], playerClass: "goalie" as const }));
    data.roster = data.players.map(player => ({ playerId: player.id, position: "active" }));
    data.games = data.games.filter(game => game.id === "A0" || game.id === "B0");
    data.forecasts = data.players.map((player, index) => issuedForecast(data, player.id, index ? "B0" : "A0",
      { stats: { GOALS_AGAINST_GOALIE: index ? 0.5 : 1 }, startProbability: index ? 0.25 : 1, confirmedStart: index === 0 }));
    data.rules.rosterSlots = { G: 1, BN: 1 };
    data.rules.goalieMinimum = { required: 1, credited: 0, counts: "starts", penalty: "none", periodStart: "2026-10-05", periodEnd: "2026-10-07" };
    data.rules.scoring.weights = { GOALS_AGAINST_GOALIE: -1 };
    data.realized = {};
    const cover = { ...intent, goalieCoverage: "cover" as const };
    const points = evaluatePlan(data, cover, "outcome");
    expect(points.assignments.map(row => row.playerId)).toEqual(["a"]);
    expect(points.recommendation?.eligible).toBe(true);
    expect(points.goalie.minimumSatisfied).toBe(false);
    expect(points.recommendation?.exclusions?.[0]).toMatchObject({ reason: "minimum_priority",
      evidence: { selectedScore: -1, withPlayerScore: -0.5,
        goalie: { credited: 0, required: 1, selectedProjected: 1, withPlayerProjected: 0.25 } } });
    const planned = planRoster(data, cover, { maxSteps: 0 });
    expect(planned.selected.assignments.map(row => row.playerId)).toEqual(["a"]);
    expect(planned.search.policyVersion).toBe("rso-search-v3");
    const partial = evaluatePlan({ ...data, rules: { ...data.rules,
      goalieMinimum: { ...data.rules.goalieMinimum, required: 2 } } }, cover, "outcome");
    expect(partial.assignments.map(row => row.playerId)).toEqual(["a"]);
    expect(partial.goalie).toMatchObject({ projected: 1, risk: true, minimumSatisfied: false });
    expect(partial.recommendation?.eligible).toBe(true);
    expect(partial.recommendation?.exclusions?.[0].reason).toBe("minimum_priority");
    const twoSlots = evaluatePlan({ ...data, rules: { ...data.rules, rosterSlots: { G: 2 } } }, cover, "outcome");
    expect(twoSlots.assignments.map(row => row.playerId)).toEqual(["a"]);
    const credited = evaluatePlan({ ...data, realized: { GOALS_AGAINST_GOALIE: 0 }, rules: { ...data.rules,
      goalieMinimum: { ...data.rules.goalieMinimum, credited: 1 } } }, cover, "outcome");
    expect(credited.assignments).toHaveLength(0);
    expect(credited.goalie.minimumSatisfied).toBe(true);
    const locked = evaluatePlan({ ...data, lockedAssignments: [{ date: "2026-10-05", playerId: "b", slotId: "G#1" }] }, cover, "outcome");
    expect(locked.assignments.map(row => row.playerId)).toEqual(["b"]);
    expect(locked.recommendation?.exclusions?.[0].reason).toBe("locked_capacity");
    const reversed = planRoster({ ...data, players: [...data.players].reverse(), games: [...data.games].reverse(),
      forecasts: [...data.forecasts].reverse(), roster: [...data.roster].reverse() }, cover, { maxSteps: 0 });
    expect(reversed.selected).toEqual(planRoster(data, cover, { maxSteps: 0 }).selected);
    const acquisition = planRoster({ ...data, players: data.players.map(player => player.id === "a"
      ? { ...player, availability: "free_agent" } : player), roster: [{ playerId: "b", position: "active" }] }, cover,
      { maxSteps: 1, maxCandidates: 1 });
    expect(acquisition.baseline.goalie.projected).toBe(0.25);
    expect(acquisition.alternatives.some(plan => plan.objective === "outcome" && plan.steps.some(step => step.playerId === "a")
      && plan.goalie.projected === 1 && plan.projectedValue === -1 && plan.comparisonEligible)).toBe(true);
    const weeklyData: PlanningSnapshot = { ...data, context: { ...data.context, endDate: "2026-10-06" },
      rules: { ...data.rules, lineupMode: "weekly", goalieMinimum: { ...data.rules.goalieMinimum, required: 2 },
        lineupPeriods: [{ id: "week", start: "2026-10-05T00:00:00Z", end: "2026-10-07T00:00:00Z", lockAt: "2026-10-05T00:00:00Z" }] },
      games: [...data.games, ...data.games.map(game => ({ ...game, id: game.id.replace("0", "1"), date: "2026-10-06",
        startsAt: "2026-10-06T20:00:00Z", scheduleRevision: `${game.scheduleRevision}-next` }))] };
    weeklyData.forecasts = weeklyData.games.map(game => issuedForecast(weeklyData, game.teamAbbreviation.toLowerCase(), game.id,
      { stats: { GOALS_AGAINST_GOALIE: game.teamAbbreviation === "A" ? 1 : 0.5 },
        startProbability: game.teamAbbreviation === "A" ? 0.8 : 0.25, confirmedStart: false }));
    const weekly = evaluatePlan(weeklyData, cover, "outcome");
    expect(weekly.assignments.map(row => row.playerId)).toEqual(["a", "a"]);
    expect(weekly.goalie).toMatchObject({ projected: 1.6, risk: true, minimumSatisfied: false });
    expect(weekly.recommendation?.eligible).toBe(true);
    const weeklyLocked = evaluatePlan({ ...weeklyData, lockedAssignments: [{ date: "2026-10-06", playerId: "b", slotId: "G#1" }] }, cover, "outcome");
    expect(weeklyLocked.assignments.map(row => row.playerId)).toEqual(["b", "b"]);
    const unknown: PlanningSnapshot = { ...data, forecasts: data.forecasts.map(forecast => forecast.playerId === "a"
      ? { ...forecast, startProbability: null, confirmedStart: false } : forecast) };
    const missing = evaluatePlan(unknown, cover, "outcome");
    expect(missing.recommendation?.eligible).toBe(false);
    expect(missing.limitations).toContain("Missing starter probabilities leave requested projected goalie coverage unresolved.");
    expect(unknown.forecasts[0].startProbability).toBeNull();
    const unknownLocked = evaluatePlan({ ...unknown,
      lockedAssignments: [{ date: "2026-10-05", playerId: "a", slotId: null }] }, cover, "outcome");
    expect(unknownLocked.assignments.map(row => row.playerId)).toEqual(["b"]);
    expect(unknownLocked.recommendation?.eligible).toBe(true);
    data.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "GOALS_AGAINST_GOALIE", direction: "lower" }] };
    data.opponent = { roster: [], realized: { GOALS_AGAINST_GOALIE: 10 }, remaining: {} };
    const category = evaluatePlan(data, cover, "outcome");
    expect(category.assignments.map(row => row.playerId)).toEqual(["a"]);
    expect(category.recommendation?.eligible).toBe(false);
    expect(category.goalie.minimumSatisfied).toBe(false);
    expect(category.goalie).toMatchObject({ credited: 0, projected: 1, confirmed: 1 });
    expect(category.recommendation?.exclusions?.[0]).toMatchObject({ reason: "unresolved_quality" });
    expect(category.recommendation?.exclusions?.[0].evidence).toBeUndefined();
  });
  it("bypasses goalie-minimum checks for a league without a minimum and reports expected starts", () => {
    const data = snapshot();
    data.players = ["a", "b"].map((id, index) => ({ ...player(id, index ? "B" : "A"), eligiblePositions: ["G"], playerClass: "goalie" as const }));
    data.roster = data.players.map(player => ({ playerId: player.id, position: "active" }));
    data.games = data.games.filter(game => game.id === "A0" || game.id === "B0");
    data.forecasts = data.players.map((player, index) => issuedForecast(data, player.id, index ? "B0" : "A0",
      { stats: { GOALS_AGAINST_GOALIE: 1 }, startProbability: index ? 0.25 : 1, confirmedStart: index === 0 }));
    data.rules.rosterSlots = { G: 2 };
    data.rules.goalieMinimum = { required: 0, credited: null, counts: "unknown", penalty: "unknown" };
    const cover = { ...intent, goalieCoverage: "cover" as const };
    const none = evaluatePlan(data, cover, "agp");
    expect(none.goalie).toMatchObject({ required: 0, risk: false, minimumSatisfied: true, expectedStarts: 1.25 });
    expect(none.limitations.filter(item => /goalie/i.test(item))).toEqual([]);
    const unknown = evaluatePlan({ ...data, rules: { ...data.rules, goalieMinimum: { ...data.rules.goalieMinimum, required: 3 } } }, cover, "agp");
    expect(unknown.goalie).toMatchObject({ risk: true, minimumSatisfied: false, expectedStarts: 1.25 });
    expect(unknown.limitations).toContain("Goalie minimum semantics are incomplete.");
  });
  it("sits harmful goalie points and ratio starts after the minimum is credited", () => {
    const data = snapshot();
    const goalie = { ...player("g", "G"), eligiblePositions: ["G"], playerClass: "goalie" as const };
    data.players = [goalie]; data.roster = [{ playerId: "g", position: "active" }];
    data.games = [{ ...data.games[0], id: "G0", teamAbbreviation: "G" }];
    data.forecasts = [issuedForecast(data, "g", "G0", { stats: { goalsAgainst: 10 }, startProbability: 1 })];
    data.rules.rosterSlots = { G: 1 };
    data.rules.scoring.weights = { goalsAgainst: -1 }; data.realized = { goalsAgainst: 0 };
    data.rules.goalieMinimum = { required: 1, credited: 1, counts: "starts", penalty: "none", periodStart: "2026-10-05", periodEnd: "2026-10-07" };
    const points = evaluatePlan(data, intent, "outcome");
    expect(points.activeGames).toBe(0);
    expect(points.goalie.risk).toBe(false);
    expect(points.recommendation?.exclusions?.[0]).toMatchObject({ reason: "negative_value",
      evidence: { scoreBasis: "points_assignment", selectedScore: 0, withPlayerScore: -10 } });
    data.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "gaa", direction: "lower", numerator: "goalsAgainst", denominator: "minutes" }] };
    data.realized = { goalsAgainst: 1, minutes: 10 };
    data.opponent = { roster: [], realized: { goalsAgainst: 2, minutes: 10 }, remaining: { goalsAgainst: 0, minutes: 0 } };
    data.forecasts[0].stats = { goalsAgainst: 10, minutes: 10 };
    const ratio = evaluatePlan(data, intent, "outcome");
    expect(ratio.activeGames).toBe(0);
    expect(ratio.goalie.risk).toBe(false);
    expect(ratio.categoryResults[0].result).toBe("win");
  });
  it.each(["points", "categories"] as const)("prefers equivalent vacant or reserve capacity before drops in %s", mode => {
    for (const capacity of ["vacancy", "IR", "IR+"] as const) {
      const data = snapshot();
      data.rules.rosterSlots = capacity === "vacancy" ? { C: 1, BN: 2 } : { C: 1, BN: 1, [capacity]: 1 };
      if (capacity !== "vacancy") data.players[0].reserveEligibility = [capacity];
      if (mode === "categories") {
        data.rules.scoring = { mode, weights: {}, categories: [{ key: "pts", direction: "higher" }] };
        data.opponent = { roster: [], realized: { pts: 0 }, remaining: { pts: 0 } };
      }
      data.forecasts = data.forecasts.map(row => row.playerId === "c" ? { ...row, stats: { pts: 3 } } : row);
      const before = structuredClone(data);
      const result = planRoster(data, intent, { maxSteps: 1, maxCandidates: 1, maxEvaluations: 100 });
      const best = result.alternatives.find(plan => plan.steps.some(step => step.type === "add"));
      expect(best).toMatchObject({ legal: true, budgetVerified: true, comparisonEligible: true, activeGames: 2,
        projectedStats: { pts: 6 }, acquisitions: { p: 1 } });
      expect(best?.steps.some(step => step.type === "drop" || step.dropPlayerId)).toBe(false);
      expect(best?.steps.filter(step => step.type === "add")).toHaveLength(1);
      expect(best?.steps.filter(step => step.type === "reserve")).toHaveLength(capacity === "vacancy" ? 0 : 1);
      const selected = result.alternatives.find(plan => plan.steps.some(step => step.dropPlayerId));
      expect(selected).toBeDefined();
      const selectedIntent = { ...intent, steps: selected!.steps };
      expect(planRoster(data, selectedIntent, { maxSteps: 1, maxCandidates: 1 }).selected.steps).toEqual(selected!.steps);
      expect(data).toEqual(before);
    }
  });
  it("checks legal reserve capacity before spending a narrow search quota on drops", () => {
    const data = snapshot();
    data.players[0].reserveEligibility = ["IR"];
    data.rules.rosterSlots.IR = 1;
    data.forecasts = data.forecasts.map(row => row.playerId === "c" ? { ...row, stats: { pts: 3 } } : row);
    const result = planRoster(data, intent, { maxSteps: 1, maxCandidates: 1, maxEvaluations: 7 });
    expect(result.alternatives.some(plan => plan.steps.some(step => step.type === "reserve")
      && plan.steps.some(step => step.type === "add") && !plan.steps.some(step => step.dropPlayerId))).toBe(true);
    expect(result.search.complete).toBe(false);
    data.lockedAssignments = [{ date: "2026-10-05", slotId: "C#0", playerId: "a" }];
    expect(planRoster(data, intent, { maxSteps: 1, maxCandidates: 1 }).alternatives
      .every(plan => !plan.steps.some(step => step.type === "reserve" && step.playerId === "a"))).toBe(true);
  });
  it("counts acquisitions rather than reserve transfers for exactly equal point outcomes", () => {
    const data = snapshot();
    data.players[0].reserveEligibility = ["IR"];
    data.players.push(player("d", "D", "free_agent"), player("e", "E", "free_agent"));
    data.rules.rosterSlots.IR = 1;
    data.games = data.games.filter(game => game.teamAbbreviation !== "C" || game.date === "2026-10-05");
    for (const [team, dates] of [["D", ["2026-10-06"]], ["E", ["2026-10-05", "2026-10-06"]]] as const) {
      for (const date of dates) data.games.push({ ...data.games[0], id: `${team}${date}`, teamAbbreviation: team,
        scheduleRevision: `${team}${date}`, date, startsAt: `${date}T20:00:00Z` });
    }
    data.forecasts = data.games.map(game => issuedForecast(data, game.teamAbbreviation.toLowerCase(), game.id,
      { stats: { pts: ["C", "D", "E"].includes(game.teamAbbreviation) ? 3 : 1 } }));
    const result = planRoster(data, { ...intent, alternativeCount: 20 },
      { maxSteps: 2, maxCandidates: 3, maxEvaluations: 1000, beamWidth: 64 });
    const equivalent = result.alternatives.filter(plan => plan.objective === "outcome" && plan.projectedValue === 6 && plan.activeGames === 2);
    expect(equivalent.some(plan => plan.steps.filter(step => step.type === "add").length === 2)).toBe(true);
    expect(equivalent[0].steps.map(step => step.type)).toEqual(["reserve", "add"]);
    expect(equivalent[0].acquisitions).toEqual({ p: 1 });
  });
  it("does not promote a lower-value reserve alternative ahead of meaningful gains", () => {
    const data = snapshot();
    data.players[0].reserveEligibility = ["IR"];
    data.rules.rosterSlots.IR = 1;
    data.forecasts = data.forecasts.map(row => ({ ...row, stats: { pts: row.playerId === "a"
      ? row.gameId === "A0" ? 10 : 1 : row.playerId === "c" ? 6 : 0 } }));
    const result = planRoster(data, { ...intent, alternativeCount: 20 }, { maxSteps: 1, maxCandidates: 1, maxEvaluations: 100 });
    const best = result.alternatives.find(plan => plan.steps.length);
    expect(best).toMatchObject({ projectedValue: 16, activeGames: 2, acquisitions: { p: 1 } });
    expect(result.alternatives.some(plan => plan.projectedValue === 16 && plan.steps.some(step => step.dropPlayerId === "b"))).toBe(true);
    expect(result.alternatives.some(plan => plan.projectedValue === 12 && plan.steps.some(step => step.type === "reserve"))).toBe(true);
  });
  it("finds an IR prerequisite with default search budget when all drops are protected", () => {
    const data = snapshot();
    data.players[1].reserveEligibility = ["IR"];
    data.rules.rosterSlots.IR = 1;
    data.forecasts = data.forecasts.map(item => item.playerId === "c" ? { ...item, stats: { pts: 3 } } : item);
    const protectedIntent = { ...intent, protectedPlayerIds: ["a", "b"] };
    const result = planRoster(data, protectedIntent, { maxCandidates: 1, maxSteps: 1 });
    expect(result.alternatives.some(item => item.steps.some(step => step.type === "reserve" && step.playerId === "b")
      && item.steps.some(step => step.type === "add" && step.playerId === "c"))).toBe(true);
  });
});


describe("schedule-first targets", () => {
  it("moves a flexible winger and shares UTIL capacity without recommending an unverified drop", () => {
    const data = snapshot();
    data.rules.rosterSlots = { LW: 1, RW: 1, UTIL: 1 };
    data.players = [{ ...player("flex", "A"), eligiblePositions: ["LW", "RW"] }, { ...player("d", "B"), eligiblePositions: ["D"] }, { ...player("wing", "C", "free_agent"), eligiblePositions: ["LW"] }];
    data.roster = [{ playerId: "flex", position: "active" }, { playerId: "d", position: "active" }];
    data.forecasts = [];
    data.rules.acquisitionTiming = "unknown";
    data.rules.acquisitionCost = null;
    data.rules.periods = [];
    const baseline = evaluatePlan(data, intent, "agp", []);
    const fits = scheduleFits(data, intent, baseline).fits;
    expect(baseline.activeGames).toBe(4);
    expect(fits).toEqual([{ teamAbbreviation: "C", positions: ["LW"], playerIds: ["wing"], addedGames: 2, dates: ["2026-10-05", "2026-10-06"] }]);
    const result = planRoster(data, intent);
    expect(result.alternatives.every(plan => !plan.steps.length)).toBe(true);
    expect(result.search.limitations.join(" ")).toContain("acquisition-effective timing");
    expect(result.scheduleFits).toEqual(fits);
    data.rules.rosterSlots = { LW: 1, UTIL: 1 };
    expect(scheduleFits(data, intent, evaluatePlan(data, intent, "agp", [])).fits).toEqual([]);
  });
  it("does not move a locked flexible player to manufacture an opening", () => {
    const data = snapshot();
    data.players = [{ ...player("a", "A"), eligiblePositions: ["LW", "RW"] }, { ...player("c", "C", "free_agent"), eligiblePositions: ["LW"] }];
    data.roster = [{ playerId: "a", position: "active" }];
    data.rules.rosterSlots = { LW: 1, RW: 1 };
    data.lockedAssignments = [{ date: "2026-10-05", playerId: "a", slotId: "LW#1" }];
    const fits = scheduleFits(data, intent, evaluatePlan(data, intent, "agp", [])).fits;
    expect(fits[0].addedGames).toBe(1);
    expect(fits[0].dates).toEqual(["2026-10-06"]);
  });
});

describe("lineup goal", () => {
  it("plans for the manager's chosen goal, defaulting to projected points when they qualify", () => {
    const data = snapshot();
    const auto = planRoster(data, intent, { maxSteps: 0 });
    expect(auto.noMoveOutcome.recommendation?.eligible).toBe(true);
    expect(auto.selected.objective).toBe("outcome");
    expect(planRoster(data, { ...intent, objective: "outcome" }, { maxSteps: 0 }).selected.objective).toBe("outcome");
    expect(planRoster(data, { ...intent, objective: "agp" }, { maxSteps: 0 }).selected.objective).toBe("agp");
  });

  it("falls back to most starts, and says so, when points are asked for without qualifying projections", () => {
    const data = snapshot();
    data.forecasts = [];
    const result = planRoster(data, { ...intent, objective: "outcome" }, { maxSteps: 0 });
    expect(result.selected.objective).toBe("agp");
    expect(result.search.limitations).toContain("Best projected points needs projections for your whole lineup; planning for most starts until then.");
  });
});

describe("injured players", () => {
  it("doesn't line up a player the provider lists as out, and says who was held out", () => {
    const data = snapshot();
    data.players = data.players.map(row => row.id === "b" ? { ...row, injury: { status: "IR", label: "Injured Reserve", note: "Upper Body" } } : row);
    const result = planRoster(data, intent, { maxSteps: 0 });
    expect(result.selected.assignments.some(row => row.playerId === "b")).toBe(false);
    expect(result.selected.limitations.some(line => line.includes("Not lined up while injured") && line.includes("b"))).toBe(true);
    // Day-to-day is still a lineup option.
    data.players = data.players.map(row => row.id === "b" ? { ...row, injury: { status: "DTD", label: "Day-to-Day", note: null } } : row);
    expect(planRoster(data, intent, { maxSteps: 0 }).selected.assignments.some(row => row.playerId === "b")).toBe(true);
  });

  it("never proposes dropping an injured or IR-slotted player, or a move into a full IR+ slot", () => {
    const data = snapshot();
    data.players = [...data.players.map(row => row.id === "b"
      ? { ...row, injury: { status: "IR", label: "Injured Reserve", note: null }, reserveEligibility: ["IR+" as const] } : row), player("d", "D")];
    data.roster = [...data.roster, { playerId: "d", position: "IR+" }];
    data.rules.rosterSlots = { ...data.rules.rosterSlots, "IR+": 1 };
    const proposals = (snap: PlanningSnapshot) => [...candidateAcquisitionSteps(snap, intent, snap.players.find(row => row.id === "c")!)];
    const full = proposals(data);
    expect(full.flat().some(step => step.type === "reserve")).toBe(false);
    expect(full.flat().flatMap(step => step.dropPlayerId ? [step.dropPlayerId] : [])).toEqual(expect.arrayContaining(["a"]));
    expect(full.flat().some(step => step.dropPlayerId === "b" || step.dropPlayerId === "d")).toBe(false);
    // With the IR+ slot free, moving him there to make room is a proposal again.
    data.roster = data.roster.filter(entry => entry.playerId !== "d");
    expect(proposals(data).flat().some(step => step.type === "reserve" && step.playerId === "b")).toBe(true);
  });

  it("keeps a provider-locked injured starter in his slot without valuing or counting the start", () => {
    const data = snapshot();
    data.players = data.players.map(row => row.id === "b" ? { ...row, injury: { status: "O", label: "Out", note: null } } : row);
    data.lockedAssignments = [{ date: "2026-10-05", playerId: "b", slotId: "C#1" }];
    const result = evaluatePlan(data, intent, "outcome", [], false);
    expect(result.legal).toBe(true);
    expect(result.limitations.some(line => line.startsWith("Locked assignment"))).toBe(false);
    // b holds C#1 on 10-05, so a cannot take it; on 10-06 (no lock) a starts.
    expect(result.assignments.map(row => `${row.date}:${row.playerId}@${row.slotId}${row.locked ? ":locked" : ""}`))
      .toEqual(["2026-10-05:b@C#1:locked", "2026-10-06:a@C#1"]);
    // Only a's 10-06 game is a remaining start; b's projection adds nothing.
    expect(result.activeGames).toBe(1);
    expect(result.projectedValue).toBe(1);
    expect(result.forecastInputs?.some(row => row.playerId === "b")).toBe(false);
  });
});


describe("games already under way", () => {
  // Yahoo locks a daily player at his game time for the rest of the day: a (A0, 20:00) has started; b (B0, 23:00) has not.
  function underway(asOf = "2026-10-05T20:30:00Z", locks: PlanningSnapshot["lockedAssignments"] = []) {
    const data = snapshot();
    data.context = { ...data.context, asOf };
    data.games = data.games.map(game => game.id === "A0" ? { ...game, status: "live" as const } : game.id === "B0" ? { ...game, startsAt: "2026-10-05T23:00:00Z" } : game);
    data.forecasts = [];
    data.lockedAssignments = locks;
    return data;
  }
  const today = (evaluation: ReturnType<typeof evaluatePlan>) => evaluation.assignments.filter(row => row.date === "2026-10-05")
    .map(row => `${row.playerId}@${row.slotId}${row.locked ? ":locked" : ""}`);

  it("keeps a started player in his pre-start slot and closes it to later games", () => {
    expect(today(evaluatePlan(underway("2026-10-05T19:00:00Z"), intent, "agp", [], false))).toEqual(["a@C#1"]);
    const live = evaluatePlan(underway(), intent, "agp", [], false);
    expect(live.legal).toBe(true);
    expect(today(live)).toEqual(["a@C#1:locked"]);
    // Only the games still to be played count as remaining starts.
    expect(live.activeGames).toBe(live.assignments.filter(row => row.date !== "2026-10-05").length);
  });

  it("follows the provider's lock for a started game instead of failing the plan", () => {
    const locked = evaluatePlan(underway(undefined, [{ date: "2026-10-05", playerId: "a", slotId: "C#1" }]), intent, "agp", [], false);
    expect(locked.legal).toBe(true);
    expect(today(locked)).toEqual(["a@C#1:locked"]);
    expect(locked.limitations.some(line => line.startsWith("Locked assignment"))).toBe(false);
    // Benched by the provider: the slot is open for the later game.
    expect(today(evaluatePlan(underway(undefined, [{ date: "2026-10-05", playerId: "a", slotId: null }]), intent, "agp", [], false))).toEqual(["b@C#1"]);
    // Provider-locked while listed out: he still holds the slot.
    const out = underway(undefined, [{ date: "2026-10-05", playerId: "a", slotId: "C#1" }]);
    out.players = out.players.map(row => row.id === "a" ? { ...row, injury: { status: "IR", label: "Injured Reserve", note: null } } : row);
    const held = evaluatePlan(out, intent, "agp", [], false);
    expect(held.legal).toBe(true);
    expect(today(held)).toEqual(["a@C#1:locked"]);
  });

  it("still shows today's locked lineup once every game today has started", () => {
    const late = evaluatePlan(underway("2026-10-05T23:30:00Z"), intent, "agp", [], false);
    expect(late.legal).toBe(true);
    expect(today(late)).toEqual(["a@C#1:locked"]);
  });
});

describe("one retention ordering across drop surfaces (R7)", () => {
  const withOwnership = (data: PlanningSnapshot, owned: Record<string, number | null>) => {
    data.players = data.players.map(row => row.id in owned ? { ...row, ownership: owned[row.id] } : row);
    return data;
  };
  it("offers the same less-rostered drop on the chip, in candidate proposals and in Best Fit swaps", () => {
    // No forecasts: every contribution is unknown, so the tie is broken by known ownership, not id.
    const data = withOwnership(snapshot(), { a: 95, b: 5 });
    data.forecasts = [];
    const chip = lineupGapReport(data, intent, evaluatePlan(data, intent, "outcome", [], false)).bestDrop;
    expect(chip).toMatchObject({ playerId: "b", caution: { level: "none", ownership: 5 } });
    const firstDrop = [...candidateAcquisitionSteps(data, intent, data.players.find(row => row.id === "c")!)].flat().find(step => step.dropPlayerId);
    expect(firstDrop?.dropPlayerId).toBe("b");
    const plans = candidatePlanMetrics(data, intent).candidates.find(row => row.playerId === "c")!.plans;
    expect(plans[0].steps.find(step => step.dropPlayerId)?.dropPlayerId).toBe("b");
    // One unknown member: the tie falls back to holdValue/id order.
    const unknown = withOwnership(snapshot(), { a: null, b: 5 });
    unknown.forecasts = [];
    expect(lineupGapReport(unknown, intent, evaluatePlan(unknown, intent, "outcome", [], false)).bestDrop).toMatchObject({ playerId: "a", caution: { level: "unknown", ownership: null } });
  });

  it("keeps and shows the less-rostered drop among exactly equivalent plans, whatever the ids", () => {
    // a plays only 10-05 and b only 10-06, both worth 1; c plays both days for 2. Dropping a or b gains the same.
    const equivalent = (owned: Record<string, number | null>) => {
      const data = withOwnership(snapshot(), owned);
      data.games = data.games.filter(game => game.id !== "A1" && game.id !== "B0");
      data.forecasts = data.games.flatMap(game => data.players.filter(row => row.teamAbbreviation === game.teamAbbreviation)
        .map(row => issuedForecast(data, row.id, game.id, { stats: { pts: row.id === "c" ? 2 : 1 } })));
      return data;
    };
    for (const [owned, kept] of [[{ a: 95, b: 5 }, "b"], [{ a: 5, b: 95 }, "a"]] as const) {
      const data = equivalent(owned);
      const plans = candidatePlanMetrics(data, intent).candidates.find(row => row.playerId === "c")!.plans;
      const best = candidatePlanForSort(plans, "points")!;
      expect(best.steps.find(step => step.dropPlayerId)?.dropPlayerId).toBe(kept);
      expect(ownershipBrokeTie(plans, best)).toBe(true);
      expect(lineupGapReport(data, intent, evaluatePlan(data, intent, "outcome", [], false)).bestDrop?.playerId).toBe(kept);
      const swaps = planRoster(data, intent).alternatives.filter(plan => plan.steps.some(step => step.dropPlayerId));
      expect(swaps[0].steps.find(step => step.dropPlayerId)?.dropPlayerId).toBe(kept);
    }
    // Unknown ownership on one side: no ownership tie-break and no tie note.
    const data = equivalent({ a: null, b: 95 });
    const plans = candidatePlanMetrics(data, intent).candidates.find(row => row.playerId === "c")!.plans;
    expect(ownershipBrokeTie(plans, candidatePlanForSort(plans, "points")!)).toBe(false);
  });
});

describe("whole-swap category gains and sacrifices (R8)", () => {
  // a plays only 10-05, b only 10-06, c (free agent) only 10-05. Adding c for a swaps the 10-05 start; b is untouched.
  const swap = { id: "swap", type: "add" as const, playerId: "c", dropPlayerId: "a", at: "2026-10-05T00:00:00Z", effectiveAt: "2026-10-05T00:00:00Z", conditional: true, dependsOn: [] };
  function categories(stats: Record<string, Record<string, number>> = { a: { GOALS: 1, SHOTS: 5 }, b: { GOALS: 0, SHOTS: 8 }, c: { GOALS: 2, SHOTS: 2 } }) {
    const data = snapshot();
    data.games = data.games.filter(game => ["A0", "B1", "C0"].includes(game.id));
    data.forecasts = data.games.flatMap(game => data.players.filter(row => row.teamAbbreviation === game.teamAbbreviation && stats[row.id])
      .map(row => issuedForecast(data, row.id, game.id, { stats: stats[row.id] })));
    data.realized = { GOALS: 0, SHOTS: 0 };
    data.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "GOALS", direction: "higher" }, { key: "SHOTS", direction: "higher" },
      { key: "SH%", direction: "higher", numerator: "GOALS", denominator: "SHOTS" }, { key: "G2", direction: "higher", numerator: "GOALS", multiplier: 2 }] };
    return data;
  }
  const pair = (data: PlanningSnapshot) => ({ baseline: evaluatePlan(data, intent, "outcome", [], false),
    plan: evaluatePlan(data, { ...intent, steps: [swap] }, "outcome", [swap], false) });
  const row = (rows: ReturnType<typeof swapCategoryBreakdown>, key: string) => rows!.find(item => item.key === key)!;

  it("splits the whole swap into the added player's gain and the dropped player's sacrifice, without an opponent", () => {
    const data = categories();
    const { baseline, plan } = pair(data);
    expect(plan).toMatchObject({ legal: true, budgetVerified: true });
    const rows = swapCategoryBreakdown(data, baseline, plan);
    expect(row(rows, "GOALS")).toMatchObject({ before: 1, after: 2, delta: 1, gain: 2, sacrifice: 1, coverage: "known", opponent: null, ratio: false });
    expect(row(rows, "SHOTS")).toMatchObject({ before: 13, after: 10, delta: -3, gain: 2, sacrifice: 5, coverage: "known" });
    // Custom multiplier scales the category, its gain and its sacrifice alike.
    expect(row(rows, "G2")).toMatchObject({ before: 2, after: 4, delta: 2, gain: 4, sacrifice: 2 });
    // Ratios are pooled over the whole lineup; components carry the change, never a per-player percentage.
    expect(row(rows, "SH%")).toMatchObject({ ratio: true, gain: null, sacrifice: null,
      components: { numerator: { key: "GOALS", net: 1 }, denominator: { key: "SHOTS", net: -3 } } });
    expect(row(rows, "SH%").before).toBeCloseTo(1 / 13);
    expect(row(rows, "SH%").after).toBeCloseTo(0.2);
    // Before/after are exactly the planner's values, and counting categories reconcile.
    for (const item of rows!) {
      expect(item.before).toBe(baseline.categoryResults.find(result => result.key === item.key)!.own);
      expect(item.after).toBe(plan.categoryResults.find(result => result.key === item.key)!.own);
      if (!item.ratio) expect(item.gain! - item.sacrifice!).toBeCloseTo(item.delta!);
    }
  });

  it("marks categories incomplete with the reason instead of zero-filling a missing projection", () => {
    const data = categories({ a: { GOALS: 1, SHOTS: 5 }, b: { GOALS: 0, SHOTS: 8 } });
    const rows = swapCategoryBreakdown(data, ...Object.values(pair(data)) as [ReturnType<typeof evaluatePlan>, ReturnType<typeof evaluatePlan>]);
    expect(row(rows, "GOALS")).toMatchObject({ coverage: "incomplete", reason: "missing projection for c 2026-10-05", gain: null, sacrifice: null, delta: null });
  });

  it("is unavailable when the plans can't be compared (different manifests or an illegal plan)", () => {
    const data = categories();
    const { baseline, plan } = pair(data);
    expect(swapCategoryBreakdown(data, baseline, { ...plan, forecastManifestId: "other" })).toBeNull();
    expect(swapCategoryBreakdown(data, baseline, { ...plan, legal: false })).toBeNull();
  });

  it("carries the same breakdown on the Best Fit plan", () => {
    const data = categories();
    const plans = candidatePlanMetrics(data, intent).candidates.find(item => item.playerId === "c")!.plans;
    const dropA = plans.find(plan => plan.steps.some(step => step.dropPlayerId === "a" && Date.parse(step.effectiveAt) === Date.parse(swap.effectiveAt)))!;
    expect(dropA.categoryBreakdown?.find(item => item.key === "GOALS")).toMatchObject({ gain: 2, sacrifice: 1, delta: 1 });
  });
});

describe("ownership provenance in saved snapshots (R7 W2)", () => {
  it("round-trips last-known ownership evidence and still parses saves without it", () => {
    const data = snapshot();
    data.players[0] = { ...data.players[0], ownershipEvidence: { value: 40, observedOn: "2026-10-07", provider: "yahoo", status: "stale" } };
    expect(snapshotSchema.parse(JSON.parse(JSON.stringify(data))).players[0].ownershipEvidence)
      .toEqual({ value: 40, observedOn: "2026-10-07", provider: "yahoo", status: "stale" });
    const legacy = snapshot();
    expect(snapshotSchema.parse(JSON.parse(JSON.stringify(legacy))).players[0].ownershipEvidence).toBeUndefined();
  });
});
