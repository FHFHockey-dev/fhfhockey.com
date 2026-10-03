import { describe, expect, it, vi } from "vitest";

import { planRoster, scheduleFits, evaluatePlan } from "./planning";
import type { PlanIntent, PlanningPlayer, PlanningSnapshot } from "./planningTypes";
import { forecastCalendarPolicy, type ContributionSource } from "../player-forecasts/contributions";

const intent: PlanIntent = { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [],
  goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 5 };

function fixture(): PlanningSnapshot {
  const players: PlanningPlayer[] = [
    { id: "owned", nhlId: null, name: "Owned", teamAbbreviation: "A", eligiblePositions: ["C"], eligibilityVerified: true,
      playerClass: "skater", availability: "rostered", ownership: null, canDrop: true, holdValue: 0, reserveEligibility: [] },
    ...["candidate-b", "candidate-a", "candidate-c"].map((id, index): PlanningPlayer => ({
      id, nhlId: null, name: id, teamAbbreviation: index === 2 ? "B" : "A", eligiblePositions: ["C"], eligibilityVerified: true,
      playerClass: "skater", availability: "free_agent", ownership: null, canDrop: false,
      holdValue: null, reserveEligibility: [],
    })),
  ];
  const games = ["A", "B"].map(team => ({ id: `game-${team}`, date: "2026-10-05",
    startsAt: "2026-10-05T20:00:00Z", teamAbbreviation: team, opponent: "X", home: true,
    status: "scheduled" as const }));
  return {
    id: "repro", context: { provider: "manual", seasonId: 20262027, leagueId: "l", teamId: "t",
      startDate: "2026-10-05", endDate: "2026-10-05", timeZone: "UTC", asOf: "2026-10-04T00:00:00Z" },
    players, roster: [{ playerId: "owned", position: "active" }], games,
    forecasts: players.map(player => ({ playerId: player.id, gameId: `game-${player.teamAbbreviation}`,
      stats: { pts: player.id === "owned" ? 1 : 3 }, conditioning: "unconditional" as const, allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
      startProbability: null, confirmedStart: false, revisionId: "r", issuedAt: "2026-10-04T00:00:00Z",
      modelVersion: null, limitations: [] })),
    rules: { lineupMode: "daily", rosterSlots: { C: 2, BN: 0 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "p", start: "2026-10-04T00:00:00Z", end: "2026-10-12T00:00:00Z", remaining: 1, source: "manager" }],
      scoring: { mode: "points", weights: { pts: 1 }, categories: [] },
      goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] },
    lockedAssignments: [], realized: { pts: 0 }, opponent: null, evidence: {},
  };
}

function qualityFixture(source: "detailed" | "baseline" | "blended", profile: "points" | "categories" | "goalie" = "points"): PlanningSnapshot {
  const snapshot = fixture();
  const goalie = profile === "goalie";
  snapshot.context.startDate = snapshot.context.endDate = "2026-10-14";
  snapshot.players = snapshot.players.map((player, index) => ({ ...player, id: String(101 + index),
    nhlId: 1001 + index, nhlTeamId: player.teamAbbreviation === "A" ? 1 : 2,
    rosterRevision: `roster-${101 + index}`, eligiblePositions: [goalie ? "G" : "C"],
    playerClass: goalie ? "goalie" : "skater" }));
  snapshot.roster = snapshot.players.slice(0, 2).map(player => ({ playerId: player.id, position: "active" }));
  snapshot.games = snapshot.games.map((game, index) => ({ ...game, id: String(30 + index),
    date: "2026-10-14", startsAt: "2026-10-14T20:00:00Z", scheduleRevision: `schedule-${30 + index}` }));
  snapshot.rules.rosterSlots = { [goalie ? "G" : "C"]: 2, BN: 1 };
  snapshot.rules.periods[0].end = "2026-10-15T00:00:00Z";
  snapshot.baselineSources = source === "detailed" ? undefined : [];
  snapshot.forecasts = snapshot.players.map((player, index) => {
    const game = snapshot.games.find(row => row.teamAbbreviation === player.teamAbbreviation)!;
    const strength = [2, 8, 12, 7][index];
    const conditional: Record<string, number> = goalie ? { SAVES_GOALIE: 20 + strength * 2, SHOTS_AGAINST_GOALIE: 23 + strength * 2,
      GOALS_AGAINST_GOALIE: 3, GOALIE_MINUTES: 60, WINS_GOALIE: 0.4 } : { GOALS: strength, ASSISTS: strength / 2 };
    // Baseline production borrows explicit compatible participation from an issued
    // row; this fixture does not pretend an independent distant-game producer exists.
    const probability = goalie ? player.nhlTeamId === 1 ? 0.25 : 0.5 : 0.5;
    const revisionId = `detail-${player.id}`;
    if (snapshot.baselineSources) for (const [targetKey, mean] of Object.entries(conditional)) {
      const baseline: ContributionSource = { kind: "baseline", sourceId: `rate-${player.id}-${targetKey}`,
        policyVersion: "fixture-rate-v1", released: true,
        allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
        playerId: Number(player.id), nhlPlayerId: player.nhlId!, seasonId: snapshot.context.seasonId,
        teamId: player.nhlTeamId!, targetKey, unit: targetKey === "GOALIE_MINUTES" ? "minutes" : "count",
        basis: goalie ? "per_start" : "per_appearance", participationIntegrated: false,
        mean: mean - (targetKey === "GOALS" ? 1 : targetKey === "ASSISTS" ? 0.5
          : ["SAVES_GOALIE", "SHOTS_AGAINST_GOALIE"].includes(targetKey) ? 2 : 0),
        cutoffAt: "2026-10-02T00:00:00Z", issuedAt: "2026-10-03T00:00:00Z", expiresAt: "2026-10-15T00:00:00Z",
        sourceWatermark: "rate-inputs", scheduleRevision: game.scheduleRevision!, rosterRevision: player.rosterRevision! };
      snapshot.baselineSources.push(baseline);
    }
    return { playerId: player.id, gameId: game.id, sourceKind: "detailed", sourceWatermark: "captured-inputs",
      issuedContext: { version: "forge-issued-context-v1", playerId: player.id, gameId: game.id,
        nhlPlayerId: player.nhlId!, seasonId: snapshot.context.seasonId, teamId: player.nhlTeamId!,
        scheduledAt: game.startsAt!, scheduleRevision: game.scheduleRevision!, rosterRevision: player.rosterRevision!,
        observedAt: "2026-10-03T00:00:00Z", scheduleSourceUpdatedAt: "2026-10-02T00:00:00Z",
        scheduleFetchedAt: "2026-10-03T00:00:00Z", identityUpdatedAt: "2026-10-02T00:00:00Z",
        membershipCreatedAt: ["2026-09-01T00:00:00Z"] },
      stats: Object.fromEntries(Object.entries(conditional).map(([key, mean]) => [key, source === "baseline" ? null : mean * probability])),
      conditionalStats: source === "baseline" ? undefined : conditional, appearanceProbability: goalie ? null : probability,
      conditioning: "unconditional", allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
      startProbability: goalie ? probability : null, confirmedStart: false,
      revisionId, issuedAt: "2026-10-03T01:00:00Z", cutoffAt: "2026-10-03T00:00:00Z",
      expiresAt: "2026-10-15T00:00:00Z", modelVersion: "fixture-forge-v1", limitations: [] };
  });
  snapshot.forecastManifest = { version: "planning-forecasts-v1", id: `quality-${source}-${profile}`,
    calendarPolicy: forecastCalendarPolicy(14), seasonId: snapshot.context.seasonId, asOf: snapshot.context.asOf,
    scheduleRevision: "schedule-snapshot", rosterRevision: "roster-snapshot",
    issuedRevisionIds: snapshot.forecasts.map(row => row.revisionId), baselineChecksum: source === "detailed" ? null : "rate-snapshot",
    requiredOpportunities: 4, forecastedOpportunities: 4, exclusionCounts: {} };
  snapshot.realized = {};
  if (profile !== "points") {
    snapshot.rules.scoring = { mode: "categories", weights: {}, categories: goalie ? [
      { key: "SAVE_PERCENTAGE", direction: "higher", numerator: "SAVES_GOALIE", denominator: "SHOTS_AGAINST_GOALIE" },
      { key: "GAA", direction: "lower", numerator: "GOALS_AGAINST_GOALIE", denominator: "GOALIE_MINUTES", multiplier: 60 },
      { key: "WINS_GOALIE", direction: "higher" },
    ] : [{ key: "GOALS", direction: "higher" }, { key: "ASSISTS", direction: "higher" }] };
    snapshot.opponent = { roster: [], realized: goalie ? { SAVES_GOALIE: 91.8, SHOTS_AGAINST_GOALIE: 100,
      GOALS_AGAINST_GOALIE: 3.2, GOALIE_MINUTES: 60, WINS_GOALIE: 0.15 } : { GOALS: 5, ASSISTS: 3 }, remaining: {} };
  } else snapshot.rules.scoring = { mode: "points", weights: { GOALS: 2, ASSISTS: 1 }, categories: [] };
  if (goalie) snapshot.rules.goalieMinimum = { required: 2, credited: 0, counts: "starts", penalty: "none",
    periodStart: "2026-10-14T00:00:00Z", periodEnd: "2026-10-15T00:00:00Z" };
  return snapshot;
}

describe("planning search reproducibility", () => {
  it.each(["detailed", "baseline", "blended"] as const)("reproduces admitted %s quality decisions across scoring profiles and input order", source => {
    for (const profile of ["points", "categories", "goalie"] as const) {
      const snapshot = qualityFixture(source, profile);
      const before = structuredClone(snapshot);
      const reversed = structuredClone(snapshot);
      reversed.players.reverse(); reversed.roster.reverse(); reversed.games.reverse(); reversed.forecasts.reverse();
      reversed.baselineSources?.reverse(); reversed.forecastManifest!.issuedRevisionIds.reverse();
      const options = { maxEvaluations: 30, maxCandidates: 3, maxSteps: 1, beamWidth: 4 };
      const one = planRoster(snapshot, intent, options);
      const two = planRoster(reversed, intent, options);
      const replayed = planRoster(JSON.parse(JSON.stringify(snapshot)), intent, options);
      for (const result of [one, two, replayed]) {
        expect(result.baseline.objective).toBe("outcome");
        expect(result.selected.recommendation?.eligible).toBe(true);
        expect(result.selected.comparisonEligible).toBe(true);
        expect(result.baseline.projectedValue).not.toBeNull();
        expect(result.baseline.recommendation?.coverage?.assignmentEligibleCount).toBeGreaterThan(0);
        const improved = result.alternatives.filter(row => row.steps.length && row.objective === "outcome"
          && row.recommendation?.eligible && row.projectedValue !== null && row.projectedValue > result.baseline.projectedValue!);
        expect(improved.length).toBeGreaterThan(0);
        expect(improved[0].comparisonEligible).toBe(true);
        expect(improved[0].recommendation?.exclusions?.length).toBeGreaterThan(0);
        expect(result.selected.forecastInputs?.length).toBeGreaterThan(0);
        expect(result.selected.forecastInputs?.every(row => row.sourceKind === source)).toBe(true);
        if (source === "blended") expect(result.selected.forecastInputs?.[0].contributions?.[profile === "goalie" ? "SAVES_GOALIE" : "GOALS"].blendWeight).toBeCloseTo(4 / 7);
        if (profile === "points") expect(result.baseline.projectedValue).toBeCloseTo(source === "detailed" ? 12.5 : source === "baseline" ? 10 : 80 / 7);
        if (profile === "goalie") {
          expect(result.selected.goalie.confirmed).toBe(0);
          expect(result.selected.goalie.minimumSatisfied).toBe(false);
          expect(result.selected.goalie.projected).toBeCloseTo(result.selected.assignments.length * 0.25);
          const ratios = result.selected.categoryResults;
          expect(ratios.find(row => row.key === "SAVE_PERCENTAGE")?.own).toBeCloseTo(result.selected.projectedStats.SAVES_GOALIE! / result.selected.projectedStats.SHOTS_AGAINST_GOALIE!);
          expect(ratios.find(row => row.key === "GAA")?.own).toBeCloseTo(3);
        }
      }
      const stable = (result: typeof one) => ({ ...result, search: { ...result.search, elapsedMs: undefined } });
      expect(stable(two)).toEqual(stable(one));
      expect(stable(replayed)).toEqual(stable(one));
      expect(snapshot).toEqual(before);
    }
  });

  it.each(["daily", "weekly"] as const)("replays admitted quality forecasts with %s locks and realized results", lineupMode => {
    const snapshot = qualityFixture("blended");
    snapshot.context.endDate = "2026-10-15";
    snapshot.rules.periods[0].end = "2026-10-16T00:00:00Z";
    snapshot.rules.lineupMode = lineupMode;
    snapshot.rules.lineupPeriods = [{ id: "week", start: "2026-10-14T00:00:00Z",
      end: "2026-10-16T00:00:00Z", lockAt: "2026-10-14T00:00:00Z" }];
    const laterGames = snapshot.games.map(game => ({ ...game, id: String(Number(game.id) + 10),
      date: "2026-10-15", startsAt: "2026-10-15T20:00:00Z", scheduleRevision: `${game.scheduleRevision}-next` }));
    snapshot.forecasts.push(...snapshot.forecasts.map(forecast => {
      const game = laterGames.find(row => row.teamAbbreviation === snapshot.players.find(player => player.id === forecast.playerId)!.teamAbbreviation)!;
      return { ...forecast, gameId: game.id, revisionId: `${forecast.revisionId}-next`,
        issuedContext: { ...forecast.issuedContext!, gameId: game.id, scheduledAt: game.startsAt,
          scheduleRevision: game.scheduleRevision } };
    }));
    snapshot.games.push(...laterGames);
    snapshot.forecastManifest!.issuedRevisionIds = snapshot.forecasts.map(row => row.revisionId);
    snapshot.forecastManifest!.requiredOpportunities = snapshot.forecastManifest!.forecastedOpportunities = 8;
    snapshot.lockedAssignments = [{ date: "2026-10-15", playerId: "101", slotId: "C#1" },
      { date: "2026-10-15", playerId: "102", slotId: null }];
    snapshot.realized = { GOALS: 2, ASSISTS: 1 };
    const reversed = structuredClone(snapshot);
    reversed.players.reverse(); reversed.roster.reverse(); reversed.games.reverse(); reversed.forecasts.reverse();
    reversed.baselineSources!.reverse(); reversed.lockedAssignments.reverse();
    const options = { maxSteps: 0 };
    const one = planRoster(snapshot, intent, options), two = planRoster(reversed, intent, options);
    expect(one.selected.objective).toBe("outcome");
    expect(one.selected.recommendation?.eligible).toBe(true);
    expect(one.selected.comparisonEligible).toBe(true);
    expect(one.selected.projectedValue).toBeCloseTo(lineupMode === "weekly" ? 8.75 : 255 / 14);
    expect(one.selected.assignments.filter(row => row.date === "2026-10-15").map(row => row.playerId)).toEqual(["101"]);
    if (lineupMode === "weekly") expect(one.selected.assignments.map(row => row.playerId)).toEqual(["101", "101"]);
    expect(one.selected.assignments.find(row => row.date === "2026-10-15")?.locked).toBe(true);
    expect(snapshot.realized).toEqual({ GOALS: 2, ASSISTS: 1 });
    expect({ ...two, search: { ...two.search, elapsedMs: undefined } }).toEqual({ ...one, search: { ...one.search, elapsedMs: undefined } });
  });

  it("retains an eligible quality checkpoint when a deadline interrupts search", () => {
    const snapshot = qualityFixture("blended");
    let tick = 0;
    const now = vi.spyOn(Date, "now").mockImplementation(() => ++tick * 1000);
    try {
      const completed = planRoster(snapshot, intent, { maxEvaluations: 30, maxSteps: 1 });
      expect(completed.baseline.objective).toBe("outcome");
      expect(completed.alternatives.some(row => row.steps.length && row.recommendation?.eligible)).toBe(true);
      const interrupted = planRoster(snapshot, intent, { maxEvaluations: 30, maxSteps: 1, timeBudgetMs: 1 });
      expect(interrupted.search.limitations.some(item => item.includes("time limit"))).toBe(true);
      expect(interrupted.search.evaluated).toBeGreaterThan(3);
      expect(interrupted.alternatives).toEqual([interrupted.baseline]);
      expect(interrupted.baseline.recommendation?.eligible).toBe(true);
      expect(interrupted.baseline.projectedValue).toBeCloseTo(80 / 7);
    } finally {
      now.mockRestore();
    }
  });

  it.each(["points", "categories", "goalie"] as const)("bounds unchecked %s bench decisions without inventing scoring evidence", profile => {
    const snapshot = qualityFixture("blended", profile);
    snapshot.roster.push({ playerId: "103", position: "bench" });
    snapshot.players[2].availability = "rostered";
    const options = { maxSteps: 0, maxBenchEvaluations: 0 };
    const result = planRoster(snapshot, intent, options);
    expect(result.search.benchEvidence).toEqual({ policyVersion: "rso-bench-v1", evaluated: 0,
      maxEvaluations: 0, complete: false, workQuotaReached: true, timeLimitReached: false });
    expect(result.selected.recommendation).toMatchObject({ eligible: false, mode: "schedule_capacity", explanationStatus: "partial" });
    expect(result.selected.recommendation?.exclusions?.[0]).toMatchObject({ reason: "explanation_incomplete" });
    expect(result.selected.recommendation?.exclusions?.[0].evidence).toBeUndefined();
    expect(result.selected.comparisonEligible).toBe(false);
    expect(result.selected.projectedValue).not.toBeNull();
    expect(result.search.complete).toBe(false);
    expect(result.search.limitations.some(item => item.includes("Bench explanations reached their work quota"))).toBe(true);
    if (profile !== "points") {
      // One returned-plan recheck and one forced slot do not prove the best of two slots.
      const partial = planRoster(snapshot, intent, { maxSteps: 0, maxBenchEvaluations: 2 });
      expect(partial.search.benchEvidence).toMatchObject({ evaluated: 2, maxEvaluations: 2, complete: false });
      expect(partial.selected.recommendation?.exclusions?.[0]).toMatchObject({ reason: "explanation_incomplete" });
      expect(partial.selected.recommendation?.exclusions?.[0].evidence).toBeUndefined();
      expect(partial.selected.comparisonEligible).toBe(false);
    }
    const reversed = structuredClone(snapshot);
    reversed.players.reverse(); reversed.roster.reverse(); reversed.games.reverse(); reversed.forecasts.reverse();
    const replay = planRoster(JSON.parse(JSON.stringify(reversed)), intent, options);
    expect({ ...replay, search: { ...replay.search, elapsedMs: undefined } }).toEqual({ ...result, search: { ...result.search, elapsedMs: undefined } });
  });

  it("prioritizes selected-plan explanations and shares duplicate receipts within the quota", () => {
    const snapshot = qualityFixture("blended");
    snapshot.roster.push({ playerId: "103", position: "bench" });
    snapshot.players[2].availability = "rostered";
    const same = planRoster(snapshot, intent, { maxSteps: 0, maxBenchEvaluations: 2 });
    expect(same.search.benchEvidence).toMatchObject({ evaluated: 2, maxEvaluations: 2, complete: true });
    expect(same.selected.recommendation?.eligible).toBe(true);
    expect(same.selected).toBe(same.baseline);
    expect(same.baseline).toBe(same.noMoveOutcome);
    const changedIntent: PlanIntent = { ...intent, steps: [{ id: "selected-add", type: "add", playerId: "104",
      dropPlayerId: "101", at: snapshot.context.asOf, effectiveAt: snapshot.context.asOf, conditional: false, dependsOn: [] }] };
    const changed = planRoster(snapshot, changedIntent, { maxSteps: 0, maxBenchEvaluations: 2 });
    expect(changed.selected.legal).toBe(true);
    expect(changed.selected.recommendation).toMatchObject({ eligible: true, explanationStatus: "complete" });
    expect(changed.selected.recommendation?.exclusions?.[0].evidence).toBeDefined();
    expect(changed.baseline.recommendation).toMatchObject({ eligible: false, explanationStatus: "partial" });
    expect(changed.search.benchEvidence).toMatchObject({ evaluated: 2, complete: false, workQuotaReached: true });
  });

  it("starts no bench rechecks after the response deadline and retains approved numerical inputs", () => {
    const snapshot = qualityFixture("blended");
    snapshot.roster.push({ playerId: "103", position: "bench" });
    snapshot.players[2].availability = "rostered";
    let tick = 0;
    const now = vi.spyOn(Date, "now").mockImplementation(() => ++tick * 1000);
    try {
      const result = planRoster(snapshot, intent, { maxSteps: 0, timeBudgetMs: 1 });
      expect(result.search.benchEvidence).toMatchObject({ evaluated: 0, complete: false, timeLimitReached: true, workQuotaReached: false });
      expect(result.selected.legal).toBe(true);
      expect(result.selected.projectedValue).not.toBeNull();
      expect(result.selected.recommendation).toMatchObject({ eligible: false, explanationStatus: "partial" });
      expect(result.selected.comparisonEligible).toBe(false);
      expect(result.selected.recommendation?.exclusions?.[0].evidence).toBeUndefined();
    } finally { now.mockRestore(); }
  });

  it("uses canonical schedule-fit and acquisition ordering across input permutations", () => {
    const first = fixture();
    const reversed = fixture();
    reversed.players.reverse(); reversed.roster.reverse(); reversed.games.reverse(); reversed.forecasts.reverse();
    const options = { maxEvaluations: 12, maxCandidates: 3, maxSteps: 1, beamWidth: 4 };
    const one = planRoster(first, intent, options);
    const two = planRoster(reversed, intent, options);
    const decisions = (result: typeof one) => ({ fits: result.scheduleFits,
      alternatives: result.alternatives.map(item => item.steps.map(step => step.id)),
      search: { ...result.search, elapsedMs: undefined } });
    expect(decisions(one)).toEqual(decisions(two));
    const fits = scheduleFits(first, intent, evaluatePlan(first, intent, "agp", []));
    expect(fits.fits.map(fit => fit.playerIds)).toEqual([["candidate-a", "candidate-b"], ["candidate-c"]]);
  });

  it("uses work quotas by default and labels an explicit time interruption", () => {
    const snapshot = fixture();
    const now = vi.spyOn(Date, "now");
    let tick = 0;
    now.mockImplementation(() => ++tick * 1_000);
    try {
      const deterministic = planRoster(snapshot, intent, { maxEvaluations: 12, maxSteps: 1 });
      expect(deterministic.search.limitations).not.toContain(expect.stringContaining("time limit"));
      const interrupted = planRoster(snapshot, intent, { maxEvaluations: 12, maxSteps: 1, timeBudgetMs: 1 });
      expect(interrupted.search.limitations.some(item => item.includes("time limit"))).toBe(true);
      expect(interrupted.alternatives).toEqual([interrupted.baseline]);
    } finally {
      now.mockRestore();
    }
  });

  it("bounds long-range default work by dates and available candidate groups", () => {
    const snapshot = fixture();
    snapshot.context.endDate = "2027-10-06";
    const template = snapshot.players[1];
    snapshot.players = [snapshot.players[0], ...Array.from({ length: 20 }, (_, index): PlanningPlayer => ({
      ...template, id: `candidate-${String(index).padStart(2, "0")}`,
      name: `Candidate ${index}`, teamAbbreviation: `T${String(index).padStart(2, "0")}`,
    }))];
    snapshot.games = [snapshot.games[0], ...snapshot.players.slice(1).map(player => ({
      ...snapshot.games[0], id: `game-${player.teamAbbreviation}`, teamAbbreviation: player.teamAbbreviation!,
    }))];
    snapshot.forecasts = snapshot.players.map(player => ({ ...snapshot.forecasts[0],
      playerId: player.id, gameId: `game-${player.teamAbbreviation}` }));
    const started = performance.now();
    const result = planRoster(snapshot, intent, { maxSteps: 1 });
    const elapsedMs = performance.now() - started;
    console.info(`Long-range planning fixture: ${elapsedMs.toFixed(1)} ms, ${result.search.evaluated} evaluations`);
    expect(result.search.evaluated).toBeLessThanOrEqual(48);
    expect(result.search.limitations.some(item => item.includes("Schedule-fit analysis reached its work quota"))).toBe(true);
    expect(result.scheduleFits!.length).toBeLessThanOrEqual(15);
  });

  it("bounds a 367-day catalog workload with 25 rostered and 300 available players", () => {
    const snapshot = fixture();
    const teams = Array.from({ length: 32 }, (_, index) => `T${String(index).padStart(2, "0")}`);
    const template = snapshot.players[0];
    snapshot.context.endDate = "2027-10-06";
    snapshot.players = Array.from({ length: 1000 }, (_, index): PlanningPlayer => ({
      ...template, id: `player-${String(index).padStart(4, "0")}`, name: `Player ${index}`,
      teamAbbreviation: teams[index % teams.length], availability: index < 25 ? "rostered"
        : index < 325 ? "free_agent" : "unknown", canDrop: index < 25,
    }));
    snapshot.roster = snapshot.players.slice(0, 25).map(player => ({ playerId: player.id, position: "bench" }));
    snapshot.rules.rosterSlots = { C: 10, BN: 15 };
    snapshot.games = teams.flatMap(team => Array.from({ length: 82 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 9, 5 + Math.floor(index * 367 / 82))).toISOString().slice(0, 10);
      return { id: `${team}:${index}`, date, startsAt: `${date}T20:00:00Z`, teamAbbreviation: team,
        opponent: "X", home: true, status: "scheduled" as const };
    }));
    snapshot.forecasts = [];
    const started = performance.now();
    const result = planRoster(snapshot, intent, { maxSteps: 1 });
    console.info(`Catalog planning fixture: ${(performance.now() - started).toFixed(1)} ms, ${result.search.evaluated} evaluations`);
    expect(result.search.evaluated).toBeLessThanOrEqual(13);
    expect(result.search.limitations.some(item => item.includes("Schedule-fit analysis reached its work quota"))).toBe(true);
  }, 10_000);
});
