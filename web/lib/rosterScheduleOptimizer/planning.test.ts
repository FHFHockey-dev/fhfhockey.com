import { describe, expect, it } from "vitest";
import { evaluatePlan, planRoster } from "./planning";
import type { PlanIntent, PlanningPlayer, PlanningSnapshot } from "./planningTypes";

const player = (id: string, team: string, availability: PlanningPlayer["availability"] = "rostered"): PlanningPlayer => ({
  id, nhlId: null, name: id, teamAbbreviation: team, eligiblePositions: ["C"], playerClass: "skater",
  availability, ownership: null, canDrop: true, holdValue: null, reserveEligibility: [],
});
const intent: PlanIntent = { revision: 3, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 5 };
function snapshot(): PlanningSnapshot {
  const players = [player("a", "A"), player("b", "B"), player("c", "C", "free_agent")];
  const games = ["2026-10-05", "2026-10-06"].flatMap((date, index) => ["A", "B", "C"].map(team => ({
    id: `${team}${index}`, date, startsAt: `${date}T20:00:00Z`, teamAbbreviation: team, opponent: "X", home: true, status: "scheduled" as const,
  })));
  return {
    id: "snap", context: { provider: "manual", seasonId: 20262027, leagueId: "l", teamId: "t", startDate: "2026-10-05", endDate: "2026-10-06", timeZone: "UTC", asOf: "2026-10-04T00:00:00Z" },
    players, roster: [{ playerId: "a", position: "active" }, { playerId: "b", position: "bench" }], games,
    forecasts: games.flatMap(game => players.filter(item => item.teamAbbreviation === game.teamAbbreviation).map(item => ({ playerId: item.id, gameId: game.id, stats: { pts: item.id === "a" ? 1 : 2 }, conditioning: "unconditional" as const, startProbability: null, confirmedStart: false, revisionId: "r", issuedAt: "2026-10-04T00:00:00Z", modelVersion: null, limitations: [] }))),
    rules: { lineupMode: "daily", rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "p", start: "2026-10-04T00:00:00Z", end: "2026-10-12T00:00:00Z", remaining: 2, source: "manager" }],
      scoring: { mode: "points", weights: { pts: 1 }, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] },
    lockedAssignments: [], realized: { pts: 0 }, opponent: null, evidence: {},
  };
}

describe("planning engine", () => {
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
  it("maximizes weekly games rather than a player's single-game score", () => {
    const data = snapshot();
    data.rules.lineupMode = "weekly";
    data.rules.lineupPeriods = [{ id: "w", start: "2026-10-05T00:00:00Z", end: "2026-10-12T00:00:00Z", lockAt: "2026-10-05T00:00:00Z" }];
    data.games = data.games.filter(game => game.id !== "A1");
    data.forecasts = data.forecasts.filter(item => item.gameId !== "A1").map(item => item.playerId === "a" ? { ...item, stats: { pts: 100 } } : item);
    const result = evaluatePlan(data, intent, "agp");
    expect(result.assignments.map(row => row.playerId)).toEqual(["b", "b"]);
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
      { ...data.forecasts[0], playerId: "g", gameId: "G0", stats: { saves: 30 }, startProbability: 0.8 },
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
    data.forecasts = [{ ...data.forecasts[0], playerId: "g", gameId: "G0", stats: { goalsAgainst: 5, minutes: 10 }, startProbability: 0.8 }];
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
    data.forecasts.push({ ...data.forecasts[0], playerId: "d", gameId: "D1", stats: { pts: 3 } });
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
    data.forecasts.push({ ...data.forecasts[0], playerId: "d", gameId: "D1", stats: { pts: 4 } });
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
  it("uses complete category wins instead of overvaluing an already won category", () => {
    const data = snapshot();
    data.games = data.games.filter(game => game.date === "2026-10-05" && game.teamAbbreviation !== "C");
    data.forecasts = [
      { ...data.forecasts[0], playerId: "a", gameId: "A0", stats: { g: 100, h: 0, unused: null } },
      { ...data.forecasts[0], playerId: "b", gameId: "B0", stats: { g: 0, h: 2, unused: null } },
    ];
    data.context.endDate = "2026-10-05";
    data.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "g", direction: "higher" }, { key: "h", direction: "higher" }] };
    data.realized = { g: 100, h: 0 };
    data.opponent = { roster: [], realized: { g: 0, h: 1 }, remaining: { g: 0, h: 0 } };
    const result = evaluatePlan(data, intent, "outcome");
    expect(result.assignments.map(row => row.playerId)).toEqual(["b"]);
    expect(result.categoryResults.map(row => row.result)).toEqual(["win", "win"]);
  });
  it("sits a ratio appearance that gains surplus saves but loses a second category", () => {
    const data = snapshot();
    const goalie = { ...player("g", "G"), eligiblePositions: ["G"], playerClass: "goalie" as const };
    data.players = [goalie]; data.roster = [{ playerId: "g", position: "active" }];
    data.games = [{ ...data.games[0], id: "G0", teamAbbreviation: "G" }];
    data.forecasts = [{ ...data.forecasts[0], playerId: "g", gameId: "G0", stats: { saves: 85, shotsAgainst: 100, goalsAgainst: 2 }, startProbability: 0.8 }];
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
  });
  it("keeps a refined weekly replacement fixed for every day in its lock window", () => {
    const data = snapshot();
    data.rules.lineupMode = "weekly";
    data.rules.lineupPeriods = [{ id: "w", start: "2026-10-05T00:00:00Z", end: "2026-10-12T00:00:00Z", lockAt: "2026-10-05T00:00:00Z" }];
    data.forecasts = data.forecasts.map(item => ({ ...item, stats: item.playerId === "a" ? { g: 100, h: 0 } : { g: 0, h: 2 } }));
    data.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "g", direction: "higher" }, { key: "h", direction: "higher" }] };
    data.realized = { g: 100, h: 0 };
    data.opponent = { roster: [], realized: { g: 0, h: 1 }, remaining: { g: 0, h: 0 } };
    const result = evaluatePlan(data, intent, "outcome");
    expect(result.assignments.map(row => row.playerId)).toEqual(["b", "b"]);
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
    data.forecasts = data.games.map(game => ({ ...data.forecasts[0], playerId: game.teamAbbreviation.toLowerCase(), gameId: game.id,
      stats: { pts: ["c", "d"].includes(game.teamAbbreviation.toLowerCase()) ? 3 : 1 } }));
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
    data.forecasts = data.forecasts.map(item => item.playerId === "c" ? { ...item, stats: { pts: 3 } } : item);
    const result = planRoster(data, intent, { maxEvaluations: 100, maxCandidates: 1, maxSteps: 1 });
    const add = result.alternatives.flatMap(item => item.steps).find(step => step.type === "add" && step.playerId === "c");
    expect(add?.at.slice(0, 10)).toBe("2026-10-04");
    expect(add?.effectiveAt.slice(0, 10)).toBe("2026-10-05");
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
    data.games = dates.flatMap(date => teams.map(team => ({ id: `${team}:${date}`, date, startsAt: `${date}T20:00:00Z`, teamAbbreviation: team, opponent: "X", home: true, status: "scheduled" as const })));
    data.forecasts = data.players.flatMap(item => dates.map(date => ({ ...snapshot().forecasts[0], playerId: item.id, gameId: `${item.teamAbbreviation}:${date}`, stats: { pts: item.availability === "rostered" ? 1 : 5 } })));
    data.rules.periods = [
      { id: "p1", start: "2026-10-04T00:00:00Z", end: "2026-10-06T00:00:00Z", remaining: 4, source: "manager" },
      { id: "p2", start: "2026-10-06T00:00:00Z", end: "2026-10-08T00:00:00Z", remaining: 4, source: "manager" },
      { id: "p3", start: "2026-10-08T00:00:00Z", end: "2026-10-10T00:00:00Z", remaining: 4, source: "manager" },
      { id: "p4", start: "2026-10-10T00:00:00Z", end: "2026-10-12T00:00:00Z", remaining: 4, source: "manager" },
    ];
    const result = planRoster(data, intent, { maxEvaluations: 250, maxCandidates: 40, beamWidth: 8, maxSteps: 4, timeBudgetMs: 2000 });
    expect(result.search.maxDepthReached).toBeGreaterThanOrEqual(2);
    expect(result.search.complete).toBe(false);
  }, 10000);
  it("keeps a credited goalie minimum satisfied when future start odds are missing", () => {
    const data = snapshot();
    const goalie = { ...player("g", "G"), eligiblePositions: ["G"], playerClass: "goalie" as const };
    data.players = [goalie]; data.roster = [{ playerId: "g", position: "active" }];
    data.games = [{ ...data.games[0], id: "G0", teamAbbreviation: "G" }];
    data.forecasts = [{ ...data.forecasts[0], playerId: "g", gameId: "G0", stats: { saves: 10 }, startProbability: null }];
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
    data.forecasts = [{ ...data.forecasts[0], playerId: "g", gameId: "G3", stats: { saves: 10 }, startProbability: 1 }];
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
    data.forecasts = [{ ...data.forecasts[0], playerId: "g", gameId: "G3", stats: { saves: 10 }, startProbability: 1 }];
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
  it("caps mutually exclusive goalie starts from the same team and game", () => {
    const data = snapshot();
    const goalies = ["g1", "g2"].map(id => ({ ...player(id, "G"), eligiblePositions: ["G"], playerClass: "goalie" as const }));
    data.players = goalies; data.roster = goalies.map(item => ({ playerId: item.id, position: "active" }));
    data.games = [{ ...data.games[0], id: "G0", teamAbbreviation: "G" }];
    data.forecasts = goalies.map(item => ({ ...data.forecasts[0], playerId: item.id, gameId: "G0", stats: { saves: 10 }, startProbability: 0.8 }));
    data.rules.rosterSlots = { G: 2 };
    data.rules.scoring.weights = { saves: 1 }; data.realized = { saves: 0 };
    data.rules.goalieMinimum = { required: 2, credited: 0, counts: "starts", penalty: "none", periodStart: "2026-10-05", periodEnd: "2026-10-07" };
    const result = evaluatePlan(data, intent, "agp");
    expect(result.activeGames).toBe(2);
    expect(result.goalie.projected).toBe(1);
    expect(result.goalie.risk).toBe(true);
  });
  it("does not auto-reserve for accepted goalie risk with negative outcome", () => {
    const data = snapshot();
    const goalie = { ...player("g", "G", "free_agent"), eligiblePositions: ["G"], playerClass: "goalie" as const };
    data.players.push(goalie); data.players[1].reserveEligibility = ["IR"];
    data.rules.rosterSlots = { C: 1, G: 1, BN: 1, IR: 1 };
    data.games = [{ ...data.games[0], id: "G0", teamAbbreviation: "G" }];
    data.forecasts = [{ ...data.forecasts[0], playerId: "g", gameId: "G0", stats: { saves: -10 }, startProbability: 1 }];
    data.rules.scoring.weights = { saves: 1 }; data.realized = { saves: 0 };
    data.rules.goalieMinimum = { required: 1, credited: 0, counts: "starts", penalty: "none", periodStart: "2026-10-05", periodEnd: "2026-10-07" };
    const result = planRoster(data, { ...intent, protectedPlayerIds: ["a", "b"] }, { maxCandidates: 1, maxSteps: 1 });
    expect(result.alternatives.every(item => item.steps.length === 0)).toBe(true);
    expect(result.baseline.goalie.risk).toBe(true);
  });
  it("sits harmful goalie points and ratio starts after the minimum is credited", () => {
    const data = snapshot();
    const goalie = { ...player("g", "G"), eligiblePositions: ["G"], playerClass: "goalie" as const };
    data.players = [goalie]; data.roster = [{ playerId: "g", position: "active" }];
    data.games = [{ ...data.games[0], id: "G0", teamAbbreviation: "G" }];
    data.forecasts = [{ ...data.forecasts[0], playerId: "g", gameId: "G0", stats: { saves: -10 }, startProbability: 1 }];
    data.rules.rosterSlots = { G: 1 };
    data.rules.scoring.weights = { saves: 1 }; data.realized = { saves: 0 };
    data.rules.goalieMinimum = { required: 1, credited: 1, counts: "starts", penalty: "none", periodStart: "2026-10-05", periodEnd: "2026-10-07" };
    const points = evaluatePlan(data, intent, "outcome");
    expect(points.activeGames).toBe(0);
    expect(points.goalie.risk).toBe(false);
    data.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "gaa", direction: "lower", numerator: "goalsAgainst", denominator: "minutes" }] };
    data.realized = { goalsAgainst: 1, minutes: 10 };
    data.opponent = { roster: [], realized: { goalsAgainst: 2, minutes: 10 }, remaining: { goalsAgainst: 0, minutes: 0 } };
    data.forecasts[0].stats = { goalsAgainst: 10, minutes: 10 };
    const ratio = evaluatePlan(data, intent, "outcome");
    expect(ratio.activeGames).toBe(0);
    expect(ratio.goalie.risk).toBe(false);
    expect(ratio.categoryResults[0].result).toBe("win");
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
