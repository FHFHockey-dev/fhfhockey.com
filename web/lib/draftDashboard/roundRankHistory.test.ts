import { describe, expect, it } from "vitest";
import { buildRoundRankHistory, roundRankMovement } from "./roundRankHistory";
import type { DraftedPlayer } from "components/DraftDashboard/DraftDashboard";

const pick = (pickNumber: number, teamId: string, playerId: string): DraftedPlayer => ({ pickNumber, teamId, playerId, round: Math.ceil(pickNumber / 2), pickInRound: (pickNumber - 1) % 2 + 1 });
const defaults: Parameters<typeof buildRoundRankHistory>[0] = {
  teamIds: ["a", "b"], picks: [], keepers: [], trades: [], pattern: { mode: "snake", reversedRounds: [] },
  rosterCapacity: 2, currentPick: 1, values: new Map([["p1", 10], ["p2", 20], ["p3", 1], ["p4", 30]]), leagueType: "points",
};
describe("completed-round rank history", () => {
  it("waits for all picks, uses equal baseline ranks, and reconstructs after undo", () => {
    const picks = [pick(1, "a", "p1"), pick(2, "b", "p2"), pick(3, "b", "p3"), pick(4, "a", "p4")];
    expect(buildRoundRankHistory({ ...defaults, picks: picks.slice(0, 1), currentPick: 2 })).toHaveLength(1);
    const history = buildRoundRankHistory({ ...defaults, picks, currentPick: 5 });
    expect(history.map((s) => s.ranks)).toEqual([{ a: 1, b: 1 }, { a: 2, b: 1 }, { a: 1, b: 2 }]);
    expect(roundRankMovement(history, 2, "a")).toEqual({ before: 2, after: 1, delta: 1 });
    expect(buildRoundRankHistory({ ...defaults, picks: picks.slice(0, 3), currentPick: 4 })).toHaveLength(2);
    expect(buildRoundRankHistory({ ...defaults, picks: [picks[0], picks[2], picks[3]], currentPick: 5 })).toHaveLength(1);
  });
  it("uses actual traded ownership and category average Score", () => {
    const history = buildRoundRankHistory({ ...defaults, leagueType: "categories", picks: [pick(1, "a", "p1"), pick(2, "a", "p2"), pick(3, "b", "p3"), pick(4, "b", "p4")], currentPick: 5 });
    expect(history[2].ranks).toEqual({ a: 2, b: 1 });
  });
  it("counts keepers once from baseline and handles a passed full-roster slot", () => {
    const history = buildRoundRankHistory({ ...defaults, rosterCapacity: 1, currentPick: 3,
      keepers: [{ version: 2, status: "valid", cost: "none", playerId: "p1", teamId: "a" }], picks: [pick(2, "b", "p2")], pattern: { mode: "custom", reversedRounds: [] } });
    expect(history).toHaveLength(2);
    expect(history[0].ranks).toEqual({ a: 1, b: 2 });
    expect(history[1].ranks).toEqual({ a: 2, b: 1 });
  });
  it("marks ranks unavailable for missing projections and keeps ties equal", () => {
    const picks = [pick(1, "a", "p1"), pick(2, "b", "missing")];
    expect(buildRoundRankHistory({ ...defaults, picks })[1].ranks).toEqual({ a: null, b: null });
    expect(buildRoundRankHistory({ ...defaults, picks, values: new Map([["p1", 10], ["missing", 10]]) })[1].ranks).toEqual({ a: 1, b: 1 });
  });
  it("resolves custom reversed-round skips and never counts a pick-cost keeper twice", () => {
    const keepers: typeof defaults.keepers = [
      { version: 2, status: "valid", cost: "pick", playerId: "p1", teamId: "a", round: 1, pickInRound: 1, pickNumber: 1 },
      { version: 2, status: "valid", cost: "none", playerId: "p3", teamId: "a" },
    ];
    const history = buildRoundRankHistory({ ...defaults, keepers, pattern: { mode: "custom", reversedRounds: [2] }, currentPick: 5,
      picks: [{ ...pick(1, "a", "p1"), isKeeper: true }, pick(2, "b", "p2"), pick(3, "b", "p4")] });
    expect(history).toHaveLength(3);
    expect(history[2].ranks).toEqual({ a: 2, b: 1 });
  });
});
