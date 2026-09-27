import { describe, expect, it } from "vitest";
import { defaultWorkspace } from "./workspace";
import { reconcileIntent } from "./reconciliation";
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
});
