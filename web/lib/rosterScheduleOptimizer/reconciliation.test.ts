import { describe, expect, it } from "vitest";
import { defaultWorkspace } from "./workspace";
import { reconcileIntent } from "./reconciliation";
import { buildTimeline } from "./planningTimeline";
import type { PlanStep, PlanningSnapshot } from "./planningTypes";

/** The timeline applies steps lazily; advance past every step before reading legality. */
const timelineLegal = (snapshot: PlanningSnapshot, steps: PlanStep[]) => {
  const timeline = buildTimeline(snapshot, defaultWorkspace(new Date("2026-10-01T00:00:00Z")).intent, steps);
  timeline.at("9999-12-31T23:59:59Z");
  return timeline.legal;
};

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

  it("rechecks selected reserve moves for eligibility, roster membership and capacity", () => {
    const workspace = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
    const member = (id: string, name: string, extra: Partial<PlanningSnapshot["players"][number]> = {}) => ({ id, nhlId: id.length, name, teamAbbreviation: "CAR",
      eligiblePositions: ["C"], playerClass: "skater" as const, availability: "rostered" as const, ownership: null, canDrop: true, holdValue: null, reserveEligibility: [], ...extra });
    const snapshot: PlanningSnapshot = { id: "refresh", context: { ...workspace.context, timeZone: "UTC" },
      players: [member("inj", "Injured", { reserveEligibility: ["IR"] }), member("holder", "Holder", { reserveEligibility: ["IR"] }),
        member("fa", "Free", { availability: "free_agent" }), member("fa2", "Second", { availability: "free_agent" })],
      roster: [{ playerId: "inj", position: "bench" }, { playerId: "holder", position: "IR" }], games: [], forecasts: [],
      rules: { ...workspace.rules, rosterSlots: { C: 1, BN: 1, IR: 2 }, acquisitionTiming: "same_day", acquisitionCost: 1,
        periods: [{ id: "week", start: "2026-10-01T00:00:00Z", end: "2026-10-08T00:00:00Z", remaining: 2, source: "provider" }] },
      lockedAssignments: [], realized: {}, opponent: null, evidence: {} };
    const at = "2026-10-02T12:00:00Z";
    const reserve = { id: "reserve", type: "reserve" as const, playerId: "inj", reservePosition: "IR" as const, at, effectiveAt: at, conditional: false, dependsOn: [] };
    const add = { id: "add", type: "add" as const, playerId: "fa", at, effectiveAt: at, conditional: true, dependsOn: ["reserve"] };
    const intent = { ...workspace.intent, steps: [reserve, add] };
    expect(timelineLegal(snapshot, intent.steps)).toBe(true);
    expect(reconcileIntent(snapshot, intent, snapshot)).toMatchObject({ issues: [], suggestedSteps: null });
    const repaired = (refreshed: PlanningSnapshot, message: string) => {
      expect(timelineLegal(refreshed, intent.steps)).toBe(false);
      const proposal = reconcileIntent(refreshed, intent, snapshot);
      expect(proposal.issues).toEqual([{ stepId: "reserve", message }, { stepId: "add", message: "A prerequisite step needs repair." }]);
      expect(proposal.suggestedSteps).toEqual([]);
    };
    repaired({ ...snapshot, players: snapshot.players.map(row => row.id === "inj" ? { ...row, reserveEligibility: [] } : row) }, "Injured is no longer verified for IR.");
    repaired({ ...snapshot, roster: snapshot.roster.filter(row => row.playerId !== "inj") }, "Injured is no longer on the actual or planned roster.");
    const full = { ...snapshot, rules: { ...snapshot.rules, rosterSlots: { C: 1, BN: 1, IR: 1 } } };
    repaired(full, "Selected moves exceed IR capacity.");
    // A retained earlier drop of the IR occupant frees the slot.
    const freed = { ...intent, steps: [{ id: "swap", type: "add" as const, playerId: "fa2", dropPlayerId: "holder", at: "2026-10-02T06:00:00Z",
      effectiveAt: "2026-10-02T06:00:00Z", conditional: true, dependsOn: [] }, reserve, add] };
    expect(timelineLegal(full, freed.steps)).toBe(true);
    expect(reconcileIntent(full, freed, full)).toMatchObject({ issues: [], suggestedSteps: null });
    expect(intent.steps).toEqual([reserve, add]);
  });

  it("flags a selected add whose effective time current timing or waiver clearance no longer allows", () => {
    const workspace = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
    const candidate = (id: string, name: string, extra: Partial<PlanningSnapshot["players"][number]> = {}) => ({ id, nhlId: id.length, name, teamAbbreviation: "CAR",
      eligiblePositions: ["C"], playerClass: "skater" as const, availability: "free_agent" as const, ownership: null, canDrop: true, holdValue: null, reserveEligibility: [], ...extra });
    const snapshot: PlanningSnapshot = { id: "refresh", context: { ...workspace.context, timeZone: "UTC" },
      players: [candidate("fa", "Free"), candidate("wv", "Waived", { availability: "waivers", waiverClearsAt: "2026-10-03T00:00:00Z" })],
      roster: [], games: [], forecasts: [], rules: { ...workspace.rules, rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
        waivers: { mode: "priority", remainingBudget: null },
        periods: [{ id: "week", start: "2026-10-01T00:00:00Z", end: "2026-10-08T00:00:00Z", remaining: 2, source: "provider" }] },
      lockedAssignments: [], realized: {}, opponent: null, evidence: {} };
    const at = "2026-10-02T12:00:00Z";
    const sameDay = { id: "same", type: "add" as const, playerId: "fa", at, effectiveAt: at, conditional: true, dependsOn: [] };
    const claim = { id: "claim", type: "add" as const, playerId: "wv", at, effectiveAt: "2026-10-03T00:00:00Z", conditional: true, dependsOn: [] };
    const intent = { ...workspace.intent, steps: [sameDay, claim] };
    expect(timelineLegal(snapshot, intent.steps)).toBe(true);
    expect(reconcileIntent(snapshot, intent, snapshot)).toMatchObject({ issues: [], suggestedSteps: null });
    const nextDay = { ...snapshot, rules: { ...snapshot.rules, acquisitionTiming: "next_day" as const } };
    expect(timelineLegal(nextDay, [sameDay])).toBe(false);
    expect(reconcileIntent(nextDay, intent, snapshot)).toMatchObject({ suggestedSteps: [claim],
      issues: [{ stepId: "same", message: "Free cannot take effect at the selected time under current league timing or waiver clearance." }] });
    const later = { ...snapshot, players: snapshot.players.map(row => row.id === "wv" ? { ...row, waiverClearsAt: "2026-10-04T00:00:00Z" } : row) };
    expect(timelineLegal(later, [claim])).toBe(false);
    expect(reconcileIntent(later, intent, snapshot)).toMatchObject({ suggestedSteps: [sameDay],
      issues: [{ stepId: "claim", message: "Waived cannot take effect at the selected time under current league timing or waiver clearance." }] });
    // Unverified timing has no earliest time to compare; the timeline reports it instead of a repair here.
    const unknown = { ...snapshot, rules: { ...snapshot.rules, acquisitionTiming: "unknown" as const } };
    expect(reconcileIntent(unknown, intent).issues).toEqual([]);
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
