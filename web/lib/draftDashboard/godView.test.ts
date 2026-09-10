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
    expect(result.map(p => p.teamId)).toEqual(owners);
    expect(result.map(p => p.pickNumber)).toEqual([3, 4, 5, 6]);
  });
  it("retains consecutive traded owners and unique pick identities", () => {
    const trades = [3, 4].map(pick => ({ version: 1 as const, status: "valid" as const, round: 1, pickInRound: pick, pickNumber: pick, originalTeamId: base.draftOrder[pick - 1], currentTeamId: "A" }));
    expect(selectGodViewQueue({ ...base, isSnakeDraft: false, trades }).map(p => [p.pickNumber, p.teamId])).toEqual([[3,"A"],[4,"A"],[5,"A"],[6,"B"]]);
  });
  it("skips keepers, completed picks and full rosters without simulating future selections", () => {
    const result = selectGodViewQueue({ ...base, startPick: 1, isSnakeDraft: false, completedPickNumbers: [1],
      keepers: [{ version: 2, status: "valid", cost: "pick", playerId: "x", teamId: "B", round: 1, pickInRound: 2, pickNumber: 2 }], teamRosterCounts: { C: 3, A: 2 } });
    expect(result.map(p => p.pickNumber)).toEqual([4,5,6,8]);
  });
  it("rebuilds after undo and truncates at the end", () => {
    expect(selectGodViewQueue({ ...base, startPick: 11 }).map(p => p.pickNumber)).toEqual([11,12]);
    expect(selectGodViewQueue({ ...base, startPick: 11, completedPickNumbers: [11,12] })).toEqual([]);
    expect(selectGodViewQueue({ ...base, startPick: 11, completedPickNumbers: [12] }).map(p => p.pickNumber)).toEqual([11]);
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
