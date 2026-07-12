import { describe, expect, it } from "vitest";
import { calculateLinesAndPairs } from "./lineCombinationHelper";
import type { PlayerData } from "./utilities";

function player(
  id: number,
  name: string,
  position: string,
  playerType: "F" | "D" | "G",
  comboPoints: number
): PlayerData {
  return {
    id,
    teamId: 10,
    franchiseId: 5,
    position,
    name,
    playerAbbrevName: name,
    lastName: name.split(" ").slice(1).join(" ") || name,
    totalTOI: 1000,
    timesOnLine: {},
    timesOnPair: {},
    percentToiWith: {},
    percentToiWithMixed: {},
    timeSpentWith: {},
    timeSpentWithMixed: {},
    GP: 10,
    timesPlayedWith: {},
    ATOI: "16:40",
    percentOfSeason: {},
    displayPosition: position,
    comboPoints,
    mutualSharedToi: {},
    playerType
  };
}

describe("calculateLinesAndPairs", () => {
  it("builds normal forward lines and defense pairs when positions are backfilled", () => {
    const roster = [
      player(1, "Auston Matthews", "C", "F", 40),
      player(2, "William Nylander", "RW", "F", 38),
      player(3, "Matthew Knies", "LW", "F", 36),
      player(4, "John Tavares", "C", "F", 34),
      player(5, "Max Domi", "C", "F", 30),
      player(6, "Bobby McMann", "C", "F", 28),
      player(7, "Morgan Rielly", "D", "D", 26),
      player(8, "Chris Tanev", "D", "D", 24),
      player(9, "Jake McCabe", "D", "D", 22),
      player(10, "Brandon Carlo", "D", "D", 20),
      player(11, "Anthony Stolarz", "G", "G", 60)
    ];

    const result = calculateLinesAndPairs(roster, "line-combination");

    expect(result.lines).toHaveLength(2);
    expect(result.lines.flat().map((entry) => entry.name)).toContain(
      "Auston Matthews"
    );
    expect(result.lines.flat().map((entry) => entry.name)).toContain(
      "Bobby McMann"
    );
    expect(result.pairs).toHaveLength(2);
    expect(result.pairs.flat().map((entry) => entry.name)).toContain(
      "Chris Tanev"
    );
    expect(result.lines.flat().some((entry) => entry.playerType === "G")).toBe(
      false
    );
  });
});
