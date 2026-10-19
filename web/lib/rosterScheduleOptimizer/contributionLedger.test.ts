import { describe, expect, it } from "vitest";
import { contributionLedger } from "./contributionLedger";
import { evaluatePlan } from "./planning";
import { defaultIntent, defaultWorkspace } from "./workspace";
import type { GameForecast, PlanningSnapshot } from "./planningTypes";

function fixture(): PlanningSnapshot {
  const workspace = defaultWorkspace(new Date("2026-10-04T12:00:00Z"));
  const players = ["a", "b", "c"].map((id, index) => ({ id, nhlId: index + 1, name: id,
    teamAbbreviation: "CAR", eligiblePositions: ["C", "LW"], eligibilityVerified: true,
    playerClass: "skater" as const, availability: "rostered" as const, canDrop: true,
    ownership: null, holdValue: null, reserveEligibility: [] }));
  return { id: "local-ledger-fixture", context: { ...workspace.context, startDate: "2026-10-05", endDate: "2026-10-06", timeZone: "UTC" },
    players, roster: players.map(player => ({ playerId: player.id, position: "bench" })),
    games: ["2026-10-05", "2026-10-06"].map(date => ({ id: date, date, startsAt: `${date}T20:00:00Z`,
      teamAbbreviation: "CAR", opponent: "NYR", home: true, status: "scheduled" })), forecasts: [],
    rules: { ...workspace.rules, rosterSlots: { C: 1, LW: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      scoring: { mode: "points", weights: { GOALS: 2 }, categories: [] } },
    lockedAssignments: [], realized: {}, opponent: null,
    evidence: { schedule: { source: "Local fixture", asOf: workspace.context.asOf, seasonId: workspace.context.seasonId,
      completeness: "complete", limitations: [] } } };
}
const intent = defaultIntent();
const evaluate = (snapshot: PlanningSnapshot) => evaluatePlan(snapshot, intent, "agp", [], false);

describe("roster contribution ledger", () => {
  it("counts each dual-eligible player/game once and retains a competing assigned set without inventing a replacement", () => {
    const snapshot = fixture(), evaluation = evaluate(snapshot);
    const before = JSON.stringify({ snapshot, evaluation, intent });
    const ledger = contributionLedger(snapshot, evaluation, intent);
    expect([...ledger.values()].reduce((sum, row) => sum + row.knownActiveGames, 0)).toBe(evaluation.activeGames);
    expect([...ledger.values()].reduce((sum, row) => sum + row.knownBenchGames, 0)).toBe(evaluation.benchGames);
    for (const row of ledger.values()) {
      expect(row.scheduledGames).toBe(2);
      expect(row.projectedPoints).toBeNull();
      expect(row.activeGames! + row.benchGames!).toBe(2);
      for (const day of row.days.filter(day => day.state === "bench")) {
        expect(day.reason).toBe("unresolved_quality");
        expect(day.competingPlayerIds).toHaveLength(2);
        expect(day.competingPlayerIds).not.toContain(row.playerId);
      }
    }
    snapshot.games.push({ ...snapshot.games[0] });
    expect(contributionLedger(snapshot, evaluation, intent)).toEqual(ledger);
    snapshot.games.pop();
    expect(JSON.stringify({ snapshot, evaluation, intent })).toBe(before);
  });

  it("preserves active/bench locks and distinguishes reserves, elapsed/cancelled games and no-game players from bench games", () => {
    const snapshot = fixture();
    snapshot.context.startDate = "2026-10-04";
    snapshot.rules.rosterSlots = { C: 1, LW: 1, BN: 2, IR: 1 };
    snapshot.players.push({ ...snapshot.players[0], id: "reserve", reserveEligibility: ["IR"] },
      { ...snapshot.players[0], id: "off", teamAbbreviation: "BOS" });
    snapshot.roster.push({ playerId: "reserve", position: "IR" }, { playerId: "off", position: "bench" });
    snapshot.lockedAssignments = [{ date: "2026-10-05", playerId: "a", slotId: "C#1" }, { date: "2026-10-06", playerId: "c", slotId: null }];
    snapshot.games.push({ ...snapshot.games[0], id: "past", date: "2026-10-04", startsAt: "2026-10-04T10:00:00Z", status: "final" },
      { ...snapshot.games[0], id: "cancelled", status: "cancelled" });
    const ledger = contributionLedger(snapshot, evaluate(snapshot), intent);
    expect(ledger.get("a")!.days).toContainEqual(expect.objectContaining({ date: "2026-10-05", state: "active", slotId: "C#1" }));
    expect(ledger.get("c")!.days).toContainEqual(expect.objectContaining({ date: "2026-10-06", state: "bench", reason: "locked_bench" }));
    expect(ledger.get("reserve")).toMatchObject({ scheduledGames: 2, activeGames: 0, benchGames: 0 });
    expect(ledger.get("reserve")!.days.map(day => day.state)).toEqual(["elapsed", "reserve", "cancelled", "reserve"]);
    expect(ledger.get("off")).toMatchObject({ scheduledGames: 0, activeGames: 0, benchGames: 0, projectedPoints: null });
    expect(ledger.get("off")!.days.every(day => day.state === "no_game")).toBe(true);
  });

  it("treats a same-day final game with unknown start time as elapsed without poisoning remaining counts", () => {
    const snapshot = fixture();
    snapshot.context.asOf = "2026-10-05T12:00:00Z";
    snapshot.games[0] = { ...snapshot.games[0], status: "final", startsAt: null };
    const evaluation = evaluate(snapshot);
    const ledger = contributionLedger(snapshot, evaluation, intent);
    for (const row of ledger.values()) {
      expect(row.scheduledGames).toBe(1);
      expect(row.activeGames! + row.benchGames!).toBe(1);
      expect(row.activeGames).not.toBeNull();
      expect(row.benchGames).not.toBeNull();
      expect(row.days[0]).toMatchObject({ date: "2026-10-05", state: "elapsed" });
      expect(row.projectedPoints).toBeNull();
    }
  });

  it("keeps vacancies and a timed drop separate from bench congestion", () => {
    const snapshot = fixture();
    snapshot.rules.rosterSlots = { C: 3, LW: 2, BN: 1 };
    const selected = { ...intent, steps: [{ id: "drop", type: "drop" as const, playerId: "c",
      at: "2026-10-05T21:00:00Z", effectiveAt: "2026-10-05T21:00:00Z", conditional: false, dependsOn: [] }] };
    const evaluation = evaluatePlan(snapshot, selected, "agp", selected.steps, false);
    expect(evaluation.legal).toBe(true);
    expect(contributionLedger(snapshot, evaluation, selected).get("c")).toMatchObject({ scheduledGames: 1, activeGames: 1, benchGames: 0,
      days: [expect.objectContaining({ state: "active" }), expect.objectContaining({ state: "outside_roster" })] });
  });

  it.each(["partial", "eligibility", "missing-player", "pending", "illegal", "unknown-start"])("withholds unknown totals for %s", problem => {
    const snapshot = fixture();
    const evaluation = evaluate(snapshot);
    if (problem === "partial") snapshot.evidence.schedule!.completeness = "partial";
    if (problem === "eligibility") snapshot.players[0].eligibilityVerified = false;
    if (problem === "missing-player") snapshot.players = snapshot.players.filter(row => row.id !== "a");
    if (problem === "illegal") evaluation.legal = false;
    if (problem === "unknown-start") { snapshot.context.asOf = "2026-10-05T12:00:00Z"; snapshot.games[0].startsAt = null; }
    const row = contributionLedger(snapshot, problem === "pending" ? null : evaluation, intent).get("a")!;
    expect(row.activeGames).toBeNull(); expect(row.benchGames).toBeNull(); expect(row.projectedPoints).toBeNull();
    if (["partial", "missing-player", "unknown-start"].includes(problem)) expect(row.scheduledGames).toBeNull();
    expect(contributionLedger(null, null, intent).size).toBe(0);
  });

  it("never double counts conflicting slot claims or treats an unsupported scoring reason as established", () => {
    const snapshot = fixture(), evaluation = evaluate(snapshot);
    const assignment = evaluation.assignments[0];
    evaluation.assignments.push({ ...assignment, slotId: "LW#1" });
    expect(contributionLedger(snapshot, evaluation, intent).get(assignment.playerId)!.activeGames).toBeNull();
    const receipt = evaluation.recommendation!.exclusions![0];
    receipt.reason = "lower_lineup_value"; delete receipt.evidence;
    expect(contributionLedger(snapshot, evaluation, intent).get(receipt.playerId)!.days
      .find(day => day.gameId === receipt.gameId)?.reason).toBe("whole_lineup_scoring");
  });

  it.each(["supported", "conditional", "forbidden", "missing", "categories"])("uses only approved assigned points, excluding banked results: %s", mode => {
    const snapshot = fixture(), evaluation = evaluate(snapshot);
    snapshot.realized = { GOALS: 100 };
    evaluation.comparisonEligible = true; evaluation.projectedValue = 212;
    evaluation.forecastInputs = evaluation.assignments.map(row => ({ playerId: row.playerId, gameId: row.gameId,
      conditioning: "unconditional", stats: { GOALS: 2 }, startProbability: null, confirmedStart: false,
      revisionId: "mechanics-only", modelVersion: "fixture", issuedAt: snapshot.context.asOf,
      allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false }, limitations: [] } as GameForecast));
    const playerId = evaluation.assignments[0].playerId;
    if (mode === "conditional") evaluation.forecastInputs[0].conditioning = "conditional_playing" as GameForecast["conditioning"];
    if (mode === "forbidden") evaluation.forecastInputs[0].allowedUses!.totals = false;
    if (mode === "missing") evaluation.forecastInputs[0].stats.GOALS = null;
    if (mode === "categories") snapshot.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "GOALS", direction: "higher" }] };
    const row = contributionLedger(snapshot, evaluation, intent).get(playerId)!;
    expect(row.projectedPoints).toBe(mode === "supported" ? 8 : null);
  });
});
