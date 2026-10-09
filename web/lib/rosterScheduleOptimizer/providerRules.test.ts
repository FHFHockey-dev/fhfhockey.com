import { describe, expect, it } from "vitest";
import { supplementProviderRules } from "./providerRules";
import { defaultWorkspace } from "./workspace";
import { evaluatePlan } from "./planning";
import type { LockedAssignment, PlanningSnapshot } from "./planningTypes";

const providerSnapshot = (): PlanningSnapshot => {
  const workspace = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
  return { id: "provider", context: { ...workspace.context, provider: "yahoo", timeZone: "America/New_York" }, players: [], roster: [], games: [], forecasts: [],
    rules: { ...workspace.rules, rosterSlots: { C: 1, BN: 1 } }, lockedAssignments: [], realized: {}, opponent: null, evidence: {} };
};

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
  it("keeps manager simulation locks separate from provider authority through saved snapshots and removal", () => {
    const snapshot = providerSnapshot();
    const providerLock: LockedAssignment = { date: "2026-10-02", playerId: "provider-player", slotId: "C#1" };
    snapshot.lockedAssignments = [providerLock];
    const managerLock: LockedAssignment = { date: "2026-10-03", playerId: "manager-player", slotId: null };
    const result = supplementProviderRules(snapshot, {}, [managerLock, managerLock]);
    expect(result.snapshot.lockedAssignments).toEqual([providerLock, { ...managerLock, source: "manager" }]);
    expect(result.snapshot.id).not.toBe(snapshot.id);
    expect(result.snapshot.evidence["Manager-selected lineup locks"].source).toBe("manager-simulation");
    expect(snapshot.lockedAssignments).toEqual([providerLock]);
    const reopened = supplementProviderRules(result.snapshot, {}, [managerLock]);
    expect(reopened.snapshot).toBe(result.snapshot);
    const removed = supplementProviderRules(result.snapshot, {}, []);
    expect(removed.snapshot.lockedAssignments).toEqual([providerLock]);
    expect(removed.snapshot.id).not.toBe(result.snapshot.id);
    expect(removed.snapshot.evidence["Manager-selected lineup locks"]).toBeUndefined();
  });
  it.each([
    { provider: { playerId: "a", slotId: "C#1" }, manager: { playerId: "a", slotId: null } },
    { provider: { playerId: "a", slotId: null }, manager: { playerId: "a", slotId: "C#1" } },
    { provider: { playerId: "a", slotId: "C#1" }, manager: { playerId: "b", slotId: "C#1" } },
  ])("preserves provider $provider.slotId against a conflicting manager $manager.slotId lock", ({ provider, manager }) => {
    const snapshot = providerSnapshot();
    const providerLock = { date: "2026-10-02", ...provider };
    const managerLock = { date: "2026-10-02", ...manager };
    snapshot.lockedAssignments = [providerLock];
    const result = supplementProviderRules(snapshot, {}, [managerLock]);
    expect(result.snapshot.lockedAssignments).toEqual([providerLock]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toContain("provider lock retained and manager choice kept for review");
    expect(managerLock).toEqual({ date: "2026-10-02", ...manager });
  });
  it("preserves a provider lock throughout its independent weekly window without using acquisition resets", () => {
    const snapshot = providerSnapshot();
    snapshot.rules.lineupMode = "weekly";
    snapshot.rules.lineupPeriods = [{ id: "lineup", start: "2026-10-01T04:00:00Z", end: "2026-10-08T04:00:00Z", lockAt: "2026-10-01T04:00:00Z" }];
    snapshot.rules.periods = [{ id: "reset", start: "2026-10-01T04:00:00Z", end: "2026-10-03T04:00:00Z", remaining: 1, source: "provider" }];
    const providerLock = { date: "2026-10-02", playerId: "a", slotId: "C#1" };
    snapshot.lockedAssignments = [providerLock];
    const result = supplementProviderRules(snapshot, {}, [
      { date: "2026-10-06", playerId: "a", slotId: null },
      { date: "2026-10-08", playerId: "a", slotId: null },
    ]);
    expect(result.snapshot.lockedAssignments).toEqual([providerLock, { date: "2026-10-08", playerId: "a", slotId: null, source: "manager" }]);
    expect(result.conflicts).toHaveLength(1);
  });
  it("leaves conflicting manager choices visible to the existing legal evaluator", () => {
    const snapshot = providerSnapshot();
    snapshot.rules.acquisitionTiming = "same_day";
    snapshot.rules.acquisitionCost = 1;
    snapshot.players = [{ id: "a", nhlId: 1, name: "Alpha", teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater",
      availability: "rostered", ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] }];
    snapshot.roster = [{ playerId: "a", position: "active" }];
    snapshot.games = [{ id: "game", date: "2026-10-02", startsAt: "2026-10-02T23:00:00Z", teamAbbreviation: "CAR", opponent: "NYR", home: true, status: "scheduled" }];
    const managerLocks: LockedAssignment[] = [{ date: "2026-10-02", playerId: "a", slotId: "C#1" }, { date: "2026-10-02", playerId: "a", slotId: null }];
    const result = supplementProviderRules(snapshot, {}, managerLocks);
    expect(result.snapshot.lockedAssignments).toEqual(managerLocks.map(lock => ({ ...lock, source: "manager" })));
    expect(result.conflicts).toEqual([]);
    const intent = defaultWorkspace().intent;
    expect(evaluatePlan(snapshot, intent, "agp").legal).toBe(true);
    expect(evaluatePlan(result.snapshot, intent, "agp").legal).toBe(false);
  });
});
