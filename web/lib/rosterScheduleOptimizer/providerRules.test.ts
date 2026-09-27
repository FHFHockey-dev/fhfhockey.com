import { describe, expect, it } from "vitest";
import { supplementProviderRules } from "./providerRules";
import { defaultWorkspace } from "./workspace";
import type { PlanningSnapshot } from "./planningTypes";

describe("manager rule supplements", () => {
  it("fills missing fields, preserves verified provider settings, and marks conflicts", () => {
    const workspace = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
    const snapshot: PlanningSnapshot = { id: "provider", context: workspace.context, players: [], roster: [], games: [], forecasts: [], rules: { ...workspace.rules, rosterSlots: { C: 1 }, acquisitionTiming: "unknown", scoring: { mode: "points", weights: { G: 2 }, categories: [] } }, lockedAssignments: [], realized: {}, opponent: null, evidence: {} };
    const result = supplementProviderRules(snapshot, { acquisitionTiming: "next_day", rosterSlots: { C: 2, G: 2 }, scoring: { weights: { G: 3, A: 1 } } });
    expect(result.snapshot.rules.acquisitionTiming).toBe("next_day");
    expect(result.snapshot.rules.rosterSlots).toEqual({ C: 1, G: 2 });
    expect(result.snapshot.rules.scoring.weights).toEqual({ G: 2, A: 1 });
    expect(result.snapshot.evidence.managerRules?.source).toBe("manager-supplied");
    expect(result.conflicts).toHaveLength(2);
    expect(snapshot.rules.acquisitionTiming).toBe("unknown");
  });
});
