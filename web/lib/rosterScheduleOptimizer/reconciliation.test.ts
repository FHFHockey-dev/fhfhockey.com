import { describe, expect, it } from "vitest";
import { defaultWorkspace } from "./workspace";
import { reconcileIntent } from "./reconciliation";
import { buildTimeline } from "./planningTimeline";
import type { PlanningSnapshot } from "./planningTypes";

describe("provider refresh reconciliation", () => {
  it("flags unavailable selected adds and leaves intent untouched", () => {
    const workspace = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
    const intent = { ...workspace.intent, revision: 1, steps: [{ id: "add-1", type: "add" as const, playerId: "fhfh:1", at: "2026-10-02T00:00:00Z", effectiveAt: "2026-10-02T00:00:00Z", conditional: false, dependsOn: [] }] };
    const snapshot: PlanningSnapshot = { id: "new", context: workspace.context, players: [{ id: "fhfh:1", nhlId: 1, name: "Alpha", teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater", availability: "rostered", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] }], roster: [], games: [], forecasts: [], rules: { ...workspace.rules, periods: [{ id: "week", start: "2026-10-01T00:00:00Z", end: "2026-10-08T00:00:00Z", remaining: 2, source: "provider" }], acquisitionCost: 1 }, lockedAssignments: [], realized: {}, opponent: null, evidence: {} };
    const proposal = reconcileIntent(snapshot, intent);
    expect(proposal.issues).toEqual([{ stepId: "add-1", message: "Alpha is no longer verified as available." }]);
    expect(proposal.suggestedSteps).toEqual([]);
    const changed = { ...snapshot, rules: { ...snapshot.rules, periods: [{ ...snapshot.rules.periods[0], remaining: 1 }], goalieMinimum: { ...snapshot.rules.goalieMinimum, credited: 1 } } };
    const refreshed = reconcileIntent(changed, intent, snapshot);
    expect(refreshed.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ stepId: null, message: expect.stringContaining("allowances") }),
      expect.objectContaining({ stepId: null, message: expect.stringContaining("Goalie minimum") }),
    ]));
    expect(reconcileIntent({ ...changed, context: { ...changed.context, teamId: "another-team" } }, intent, snapshot).issues).toEqual(proposal.issues);
    expect(intent.steps).toHaveLength(1);
  });

  it("does not charge an invalid add or treat it as a later drop prerequisite", () => {
    const workspace = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
    const players = [
      { id: "unavailable", nhlId: 1, name: "Unavailable", teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater" as const, availability: "rostered" as const, ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] },
      { id: "available", nhlId: 2, name: "Available", teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater" as const, availability: "free_agent" as const, ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] },
      { id: "dependent", nhlId: 3, name: "Dependent", teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater" as const, availability: "free_agent" as const, ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] },
    ];
    const snapshot: PlanningSnapshot = { id: "refresh", context: workspace.context, players, roster: [], games: [], forecasts: [],
      rules: { ...workspace.rules, periods: [{ id: "week", start: "2026-10-01T00:00:00Z", end: "2026-10-08T00:00:00Z", remaining: 1, source: "provider" }], acquisitionCost: 1 },
      lockedAssignments: [], realized: {}, opponent: null, evidence: {} };
    const step = (id: string, playerId: string, at: string, dropPlayerId?: string) =>
      ({ id, type: "add" as const, playerId, at, effectiveAt: at, conditional: true, dependsOn: [], ...(dropPlayerId ? { dropPlayerId } : {}) });
    const intent = { ...workspace.intent, steps: [
      step("invalid", "unavailable", "2026-10-02T00:00:00Z"),
      step("valid", "available", "2026-10-03T00:00:00Z"),
      step("dependent", "dependent", "2026-10-04T00:00:00Z", "unavailable"),
    ] };
    const proposal = reconcileIntent(snapshot, intent);
    expect(proposal.issues.some(issue => issue.stepId === "valid")).toBe(false);
    expect(proposal.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ stepId: "invalid", message: expect.stringContaining("no longer verified") }),
      expect.objectContaining({ stepId: "dependent", message: expect.stringContaining("drop prerequisite") }),
    ]));
    expect(proposal.suggestedSteps).toEqual([intent.steps[1]]);
    expect(intent.steps).toHaveLength(3);

    const explicitDependency = { ...intent, steps: [
      intent.steps[0],
      { ...intent.steps[2], dropPlayerId: undefined, dependsOn: ["invalid"], at: "2026-10-02T12:00:00Z", effectiveAt: "2026-10-02T12:00:00Z" },
      intent.steps[1],
    ] };
    const dependentProposal = reconcileIntent(snapshot, explicitDependency);
    expect(dependentProposal.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ stepId: "dependent", message: "A prerequisite step needs repair." }),
    ]));
    expect(dependentProposal.issues.some(issue => issue.stepId === "valid")).toBe(false);
    expect(dependentProposal.suggestedSteps).toEqual([intent.steps[1]]);

    const sameTime = { ...intent, steps: [
      { ...intent.steps[2], dropPlayerId: undefined, dependsOn: ["valid"], at: "2026-10-03T00:00:00Z", effectiveAt: "2026-10-03T00:00:00Z" },
      { ...intent.steps[1], at: "2026-10-02T20:00:00-04:00", effectiveAt: "2026-10-02T20:00:00-04:00" },
    ] };
    const sameTimeProposal = reconcileIntent(snapshot, sameTime);
    expect(sameTimeProposal.issues).toEqual([{ stepId: "dependent", message: "Selected moves exceed the week acquisition allowance." }]);
    expect(sameTimeProposal.suggestedSteps).toEqual([sameTime.steps[1]]);
  });

  it("keeps a later standalone drop of a player acquired by a retained selected add", () => {
    const workspace = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
    const snapshot: PlanningSnapshot = { id: "refresh", context: workspace.context,
      players: [{ id: "candidate", nhlId: 4, name: "Candidate", teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater", availability: "free_agent", ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] }],
      roster: [], games: [], forecasts: [], rules: { ...workspace.rules, acquisitionTiming: "same_day", acquisitionCost: 1,
        periods: [{ id: "week", start: "2026-10-01T00:00:00Z", end: "2026-10-08T00:00:00Z", remaining: 1, source: "provider" }] },
      lockedAssignments: [], realized: {}, opponent: null, evidence: {} };
    const intent = { ...workspace.intent, steps: [
      { id: "add", type: "add" as const, playerId: "candidate", at: "2026-10-02T00:00:00Z", effectiveAt: "2026-10-02T00:00:00Z", conditional: true, dependsOn: [] },
      { id: "drop", type: "drop" as const, playerId: "candidate", at: "2026-10-03T00:00:00Z", effectiveAt: "2026-10-03T00:00:00Z", conditional: false, dependsOn: ["add"] },
    ] };
    const proposal = reconcileIntent(snapshot, intent, snapshot);
    expect(buildTimeline(snapshot, intent, intent.steps).legal).toBe(true);
    expect(proposal.issues).toEqual([]);
    expect(proposal.suggestedSteps).toBeNull();
    expect(intent.steps).toHaveLength(2);
  });
});
