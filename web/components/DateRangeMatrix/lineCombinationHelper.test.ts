import { describe, expect, it } from "vitest";
import { calculateLinesAndPairs } from "./lineCombinationHelper";
import type { PlayerData } from "./utilities";

function player(
  id: number,
  name: string,
  position: string,
  playerType: "F" | "D" | "G",
  comboPoints: number,
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
    timesOnLine: playerType === "F" ? { "1": comboPoints } : {},
    timesOnPair: playerType === "D" ? { "1": comboPoints } : {},
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
    playerType,
  };
}

function fullRoster(): PlayerData[] {
  return [
    ...Array.from({ length: 15 }, (_, index) =>
      player(
        index + 1,
        `Forward ${index + 1}`,
        index % 3 === 0 ? "LW" : index % 3 === 1 ? "C" : "RW",
        "F",
        100 - index,
      ),
    ),
    ...Array.from({ length: 8 }, (_, index) =>
      player(101 + index, `Defense ${index + 1}`, "D", "D", 100 - index),
    ),
    player(201, "Test Goalie", "G", "G", 100),
  ];
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
      player(11, "Anthony Stolarz", "G", "G", 60),
    ];

    const result = calculateLinesAndPairs(roster, "line-combination");

    expect(result.lines).toHaveLength(2);
    expect(result.lines.flat().map((entry) => entry.name)).toContain(
      "Auston Matthews",
    );
    expect(result.lines.flat().map((entry) => entry.name)).toContain(
      "Bobby McMann",
    );
    expect(result.pairs).toHaveLength(2);
    expect(result.pairs.flat().map((entry) => entry.name)).toContain(
      "Chris Tanev",
    );
    expect(result.lines.flat().some((entry) => entry.playerType === "G")).toBe(
      false,
    );
  });

  it("derives combo points without mutating the input players", () => {
    const roster = [
      player(1, "First Forward", "LW", "F", 3),
      player(2, "Second Forward", "C", "F", 2),
      player(3, "Third Forward", "RW", "F", 1),
    ];
    const inputSnapshot = structuredClone(roster);

    const result = calculateLinesAndPairs(roster, "line-combination");

    expect(roster).toEqual(inputSnapshot);
    expect(result.lines[0]).toEqual([
      expect.objectContaining({ id: 1, comboPoints: 12 }),
      expect.objectContaining({ id: 2, comboPoints: 8 }),
      expect.objectContaining({ id: 3, comboPoints: 4 }),
    ]);
    expect(result.lines[0][0]).not.toBe(roster[0]);
  });

  it("caps line-combination groups and preserves every full-roster group", () => {
    const roster = fullRoster();

    const lineCombination = calculateLinesAndPairs(roster, "line-combination");
    const fullRosterResult = calculateLinesAndPairs(roster, "full-roster");

    expect(lineCombination.lines).toHaveLength(4);
    expect(lineCombination.pairs).toHaveLength(3);
    expect(fullRosterResult.lines).toHaveLength(5);
    expect(fullRosterResult.pairs).toHaveLength(4);
  });
});
