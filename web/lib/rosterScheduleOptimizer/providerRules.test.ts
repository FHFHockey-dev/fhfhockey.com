import { describe, expect, it } from "vitest";
import { supplementProviderRules } from "./providerRules";
import { defaultWorkspace } from "./workspace";
import { evaluatePlan } from "./planning";
import { candidatePlanMetrics } from "./candidatePlanMetrics";
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

const weeklyWindowLimitation = "Supply verified weekly lineup windows; the roster response alone does not establish their exact locks.";
const weeklyWindows = [{ id: "lineup-week", start: "2026-10-05T04:00:00Z", end: "2026-10-12T04:00:00Z", lockAt: "2026-10-05T04:00:00Z" }];
function weeklySnapshot() {
  const snapshot = providerSnapshot();
  snapshot.context = { ...snapshot.context, startDate: "2026-10-05", endDate: "2026-10-11", asOf: "2026-10-04T12:00:00Z" };
  snapshot.rules = { ...snapshot.rules, lineupMode: "weekly", lineupPeriods: [], rosterSlots: { C: 1 },
    acquisitionTiming: "same_day", acquisitionCost: 1,
    periods: [{ id: "moves", start: "2026-10-04T00:00:00Z", end: "2026-10-12T04:00:00Z", remaining: 1, source: "manager" }],
    unsupported: [weeklyWindowLimitation] };
  snapshot.players = ["CAR", "TOR"].map((team, index) => ({ id: String(index + 1), nhlId: index + 1,
    name: `Synthetic ${team}`, teamAbbreviation: team, eligiblePositions: ["C"], eligibilityVerified: true,
    playerClass: "skater", availability: index ? "free_agent" : "rostered", ownership: null, canDrop: true,
    holdValue: null, reserveEligibility: [] }));
  snapshot.roster = [{ playerId: "1", position: "active" }];
  snapshot.games = [{ id: "1", date: "2026-10-06", teamAbbreviation: "CAR" },
    { id: "2", date: "2026-10-05", teamAbbreviation: "TOR" }, { id: "3", date: "2026-10-07", teamAbbreviation: "TOR" }]
    .map(game => ({ ...game, startsAt: `${game.date}T23:00:00Z`, opponent: "NJD", home: true, status: "scheduled" }));
  snapshot.evidence.schedule = { source: "Synthetic complete calendar", seasonId: snapshot.context.seasonId,
    asOf: snapshot.context.asOf, completeness: "complete", limitations: [] };
  return snapshot;
}

describe("manager-supplied weekly windows", () => {
  it("retires the resolved missing-window blocker and makes legal weekly net AGP available without forecasts", () => {
    const snapshot = weeklySnapshot();
    const before = JSON.stringify(snapshot);
    const result = supplementProviderRules(snapshot, { lineupPeriods: weeklyWindows });
    expect(result.snapshot.rules.unsupported).not.toContain(weeklyWindowLimitation);
    expect(result.snapshot.evidence.managerRules).toMatchObject({ source: "manager-supplied", completeness: "partial" });
    const metrics = candidatePlanMetrics(result.snapshot, defaultWorkspace().intent);
    expect(metrics.candidates[0].plans.some(plan => plan.netAGP === 1)).toBe(true);
    expect(metrics.candidates[0].plans.every(plan => plan.netPoints === null)).toBe(true);
    expect(result.snapshot.roster).toBe(snapshot.roster);
    expect(result.snapshot.evidence.schedule).toBe(snapshot.evidence.schedule);
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(supplementProviderRules(snapshot, {}).snapshot.rules.unsupported).toContain(weeklyWindowLimitation);
  });
  it.each(["no windows", "missing lock", "partial range", "intraday gap", "short last day", "overlap", "reversed", "lock after end", "invalid instant"])("keeps the blocker for %s", problem => {
    const snapshot = weeklySnapshot();
    let windows: NonNullable<PlanningSnapshot["rules"]["lineupPeriods"]> = structuredClone(weeklyWindows);
    if (problem === "no windows") windows = [];
    if (problem === "missing lock") windows[0].lockAt = null;
    if (problem === "partial range") windows[0].end = "2026-10-10T04:00:00Z";
    if (problem === "intraday gap") windows = [
      { ...weeklyWindows[0], end: "2026-10-06T16:00:00Z" },
      { id: "after-gap", start: "2026-10-06T18:00:00Z", end: weeklyWindows[0].end, lockAt: "2026-10-06T18:00:00Z" },
    ];
    if (problem === "short last day") windows[0].end = "2026-10-11T06:00:00Z";
    if (problem === "overlap") windows.push({ ...windows[0], id: "overlap" });
    if (problem === "reversed") windows[0].end = "2026-10-04T04:00:00Z";
    if (problem === "lock after end") windows[0].lockAt = "2026-10-13T04:00:00Z";
    if (problem === "invalid instant") windows[0].start = "invalid";
    expect(supplementProviderRules(snapshot, { lineupPeriods: windows }).snapshot.rules.unsupported).toContain(weeklyWindowLimitation);
  });
  it("keeps the blocker when the final day is covered for only one second before an evening game", () => {
    const snapshot = weeklySnapshot();
    snapshot.games.push({ ...snapshot.games[0], id: "final-evening", date: "2026-10-11", startsAt: "2026-10-11T23:00:00Z" });
    const result = supplementProviderRules(snapshot, { lineupPeriods: [{ ...weeklyWindows[0], end: "2026-10-11T04:00:01Z" }] });
    expect(result.snapshot.rules.unsupported).toContain(weeklyWindowLimitation);
    expect(candidatePlanMetrics(result.snapshot, defaultWorkspace().intent).candidates[0].plans.every(plan => plan.netAGP === null)).toBe(true);
  });
  it.each([
    { name: "complete spring-forward week", startDate: "2026-03-02", endDate: "2026-03-08", timeZone: "America/New_York", start: "2026-03-02T05:00:00Z", end: "2026-03-09T04:00:00Z", complete: true },
    { name: "spring-forward week one second short", startDate: "2026-03-02", endDate: "2026-03-08", timeZone: "America/New_York", start: "2026-03-02T05:00:00Z", end: "2026-03-09T03:59:59Z", complete: false },
    { name: "complete fall-back week", startDate: "2026-10-26", endDate: "2026-11-01", timeZone: "America/New_York", start: "2026-10-26T04:00:00Z", end: "2026-11-02T05:00:00Z", complete: true },
    { name: "fall-back week missing its extra hour", startDate: "2026-10-26", endDate: "2026-11-01", timeZone: "America/New_York", start: "2026-10-26T04:00:00Z", end: "2026-11-02T04:00:00Z", complete: false },
    { name: "complete week east of UTC", startDate: "2026-10-26", endDate: "2026-11-01", timeZone: "Asia/Tokyo", start: "2026-10-25T15:00:00Z", end: "2026-11-01T15:00:00Z", complete: true },
  ])("uses league-local boundaries for $name", ({ startDate, endDate, timeZone, start, end, complete }) => {
    const snapshot = weeklySnapshot();
    snapshot.context = { ...snapshot.context, startDate, endDate, timeZone };
    const result = supplementProviderRules(snapshot, { lineupPeriods: [{ id: "dst-week", start, end, lockAt: start }] });
    expect(result.snapshot.rules.unsupported.includes(weeklyWindowLimitation)).toBe(!complete);
  });
  it.each([false, true])("keeps an intraday period transition unsupported across the repeated fall-back hour (gap: %s)", gap => {
    const snapshot = weeklySnapshot();
    snapshot.context = { ...snapshot.context, startDate: "2026-10-26", endDate: "2026-11-01" };
    snapshot.games = [{ ...snapshot.games[0], id: "after-fallback", date: "2026-11-01", startsAt: "2026-11-01T23:00:00Z" }];
    const secondStart = gap ? "2026-11-01T07:00:00Z" : "2026-11-01T06:00:00Z";
    const result = supplementProviderRules(snapshot, { lineupPeriods: [
      { id: "before-fallback", start: "2026-10-26T04:00:00Z", end: "2026-11-01T06:00:00Z", lockAt: "2026-10-26T04:00:00Z" },
      { id: "after-fallback", start: secondStart, end: "2026-11-02T05:00:00Z", lockAt: secondStart },
    ] });
    expect(result.snapshot.rules.unsupported).toContain(weeklyWindowLimitation);
    expect(evaluatePlan(result.snapshot, defaultWorkspace().intent, "agp").limitations).toContain(weeklyWindowLimitation);
  });
  it.each([
    { name: "spring-forward", startDate: "2026-03-02", endDate: "2026-03-09", start: "2026-03-02T05:00:00Z", seam: "2026-03-09T04:00:00Z", end: "2026-03-10T04:00:00Z" },
    { name: "fall-back", startDate: "2026-10-26", endDate: "2026-11-02", start: "2026-10-26T04:00:00Z", seam: "2026-11-02T05:00:00Z", end: "2026-11-03T05:00:00Z" },
  ])("accepts adjoining periods at local midnight after $name", ({ startDate, endDate, start, seam, end }) => {
    const snapshot = weeklySnapshot();
    snapshot.context = { ...snapshot.context, startDate, endDate };
    const result = supplementProviderRules(snapshot, { lineupPeriods: [
      { id: "first", start, end: seam, lockAt: start },
      { id: "second", start: seam, end, lockAt: seam },
    ] });
    expect(result.snapshot.rules.unsupported).not.toContain(weeklyWindowLimitation);
  });
  it("preserves unrelated unsupported rules and authoritative provider windows", () => {
    const snapshot = weeklySnapshot();
    snapshot.rules.unsupported.push("Unmapped scoring head remains unsupported.");
    const result = supplementProviderRules(snapshot, { lineupPeriods: weeklyWindows });
    expect(result.snapshot.rules.unsupported).toEqual(["Unmapped scoring head remains unsupported."]);
    snapshot.rules.lineupPeriods = [{ ...weeklyWindows[0], lockAt: "2026-10-05T03:00:00Z" }];
    const conflicting = supplementProviderRules(snapshot, { lineupPeriods: weeklyWindows });
    expect(conflicting.snapshot.rules.lineupPeriods).toEqual(snapshot.rules.lineupPeriods);
    expect(conflicting.conflicts).toContain("Lineup periods differs from the manager input; provider setting retained.");
  });
});
