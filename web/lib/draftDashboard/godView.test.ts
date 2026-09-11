import { describe, expect, it } from "vitest";
import { selectGodViewQueue, godViewRosterProgress, godViewRosterNeeds } from "./godView";
import { getEffectiveRosterConfig } from "./forwardGrouping";

const base = { startPick: 3, maxPickNumber: 12, draftOrder: ["A", "B", "C", "D"], rosterCapacity: 3 };
describe("God View known pick queue", () => {
  it.each([
    ["standard", [], ["C", "D", "A", "B"]],
    ["snake", [], ["C", "D", "D", "C"]],
    ["custom", [2], ["C", "D", "D", "C"]],
  ] as const)("respects %s ordering across rounds", (mode, rounds, owners) => {
    const result = selectGodViewQueue({ ...base, orderPattern: { mode, reversedRounds: [...rounds] } });
    expect(result.slice(2, 6).map(p => p.teamId)).toEqual(owners);
    expect(result.map(p => p.pickNumber)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(result.filter(p => p.pickInRound === 1).map(p => [p.pickNumber, p.round])).toEqual([[1,1],[5,2],[9,3]]);
  });
  it("retains consecutive traded owners and unique pick identities", () => {
    const trades = [3, 4].map(pick => ({ version: 1 as const, status: "valid" as const, round: 1, pickInRound: pick, pickNumber: pick, originalTeamId: base.draftOrder[pick - 1], currentTeamId: "A" }));
    expect(selectGodViewQueue({ ...base, isSnakeDraft: false, trades }).slice(2, 6).map(p => [p.pickNumber, p.teamId])).toEqual([[3,"A"],[4,"A"],[5,"A"],[6,"B"]]);
  });
  it("retains keepers, completed picks, skips and future picks", () => {
    const result = selectGodViewQueue({ ...base, startPick: 4, isSnakeDraft: false, completedPickNumbers: [1],
      keepers: [{ version: 2, status: "valid", cost: "pick", playerId: "x", teamId: "B", round: 1, pickInRound: 2, pickNumber: 2 }], teamRosterCounts: { C: 3, A: 2 } });
    expect(result).toHaveLength(12);
    expect(result.slice(0,4).map(p => p.status)).toEqual(["completed", "keeper", "skipped", "upcoming"]);
    expect(result[1].playerId).toBe("x");
    expect(result[2].playerId).toBeUndefined();
  });
  it("retains the final pick and restores its state after undo", () => {
    const complete = selectGodViewQueue({ ...base, startPick: 13, draftedPlayers: [{ playerId: "last", teamId: "D", pickNumber: 12 }] });
    expect(complete).toHaveLength(12);
    expect(complete[11]).toMatchObject({ pickNumber: 12, status: "completed", playerId: "last", teamId: "D" });
    const undone = selectGodViewQueue({ ...base, startPick: 12 });
    expect(undone[11]).toMatchObject({ pickNumber: 12, status: "upcoming", playerId: undefined });
    expect(selectGodViewQueue({ ...base, draftOrder: [] })).toEqual([]);
  });
});

describe("God View assigned roster slots", () => {
  const config = { C: 1, LW: 1, RW: 1, D: 1, G: 0, utility: 1, bench: 1 };
  it("counts assigned multi-position players, overrides, UTIL and bench once", () => {
    const player = { playerId: "multi" };
    const progress = godViewRosterProgress(config, { rosterSlots: { C: [], LW: [player], UTILITY: [{}] }, bench: [{}] });
    expect(progress.map(p => [p.label,p.filled,p.open])).toEqual([["C",0,1],["LW",1,0],["RW",0,1],["D",0,1],["UTIL",1,0],["BN",1,0]]);
  });
  it("uses effective grouped forwards and retains overages, including zero-capacity slots", () => {
    const grouped = getEffectiveRosterConfig(config, "fwd");
    const progress = godViewRosterProgress(grouped, { rosterSlots: { FWD: [{},{},{},{}], G: [{}] }, bench: [] });
    expect(progress.find(p => p.label === "FWD")).toMatchObject({ filled: 4, capacity: 3, over: 1, fraction: 1 });
    expect(progress.find(p => p.label === "G")).toMatchObject({ filled: 1, capacity: 0, over: 1, fraction: 1 });
    expect(progress.some(p => p.label === "C")).toBe(false);
  });
});

it("summarizes required vacancies before utility and bench without changing occupancy", () => {
  const progress = godViewRosterProgress({ C: 2, utility: 3, D: 4, bench: 6, G: 2 }, { rosterSlots: { C: [{}], D: [{}, {}], G: [{}] }, bench: [] });
  expect(godViewRosterNeeds(progress).map(slot => [slot.label, slot.open])).toEqual([["D", 2], ["C", 1], ["G", 1]]);
  expect(progress.find(slot => slot.label === "D")?.filled).toBe(2);
});
