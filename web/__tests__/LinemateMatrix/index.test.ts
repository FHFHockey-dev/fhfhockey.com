import { describe, expect, test } from "vitest";

import shiftcharts_2023020850 from "./shiftcharts-2023020850.json";
import { table, players, sortedByLineCombination } from "./LineCombinationData";
import { getPairwiseTOI } from "components/LinemateMatrix/utilities";
import { sortByLineCombination } from "components/LinemateMatrix";

describe("getPairwiseTOI", () => {
  test("Game: 2023020850. Ryan & Ekholm", () => {
    // Ekholm and Ryan were on the ice together for 2.42 minutes
    const Ryan = 8478585;
    const Ekholm = 8475218;
    expect(getPairwiseTOI(shiftcharts_2023020850.data, Ryan, Ekholm)).toEqual(
      145
    );
  });

  test("Game: 2023020850. Ryan & Ryan", () => {
    // Ekholm and Ryan were on the ice together for 2.42 minutes
    const Ryan = 8478585;
    expect(getPairwiseTOI(shiftcharts_2023020850.data, Ryan, Ryan)).toEqual(
      615
    );
  });

  test("Stay the same amount of time", () => {
    const data = [
      {
        id: 1,
        startTime: "01:00",
        endTime: "01:30",
        duration: "00:30",
        period: 1,
        playerId: 1,
      },
      {
        id: 2,
        startTime: "01:00",
        endTime: "01:30",
        duration: "00:30",
        period: 1,
        playerId: 2,
      },
    ] as any;
    expect(getPairwiseTOI(data, 1, 2)).toEqual(30);
  });

  test("p1 stays 30s at period 1 and p2 stays 15s at period 1", () => {
    const data = [
      {
        id: 1,
        startTime: "01:00",
        endTime: "01:30",
        duration: "00:30",
        period: 1,
        playerId: 1,
      },
      {
        id: 2,
        startTime: "01:00",
        endTime: "01:15",
        duration: "00:15",
        period: 1,
        playerId: 2,
      },
    ] as any;
    expect(getPairwiseTOI(data, 1, 2)).toEqual(15);
  });

  test("p1 stays 30s at period 1 and p2 stays 1 minute at period 2", () => {
    const data = [
      {
        id: 1,
        startTime: "01:00",
        endTime: "01:30",
        duration: "00:30",
        period: 1,
        playerId: 1,
      },
      {
        id: 2,
        startTime: "01:00",
        endTime: "02:00",
        duration: "01:00",
        period: 2,
        playerId: 2,
      },
    ] as any;

    expect(getPairwiseTOI(data, 1, 2)).toEqual(0);
  });

  test("p1 stays 1:10 at period 1 and p2 stays 1 minute at period 2", () => {
    const data = [
      {
        startTime: "01:00",
        endTime: "01:30",
        duration: "00:30",
        period: 1,
        playerId: 1,
      },
      {
        startTime: "02:00",
        endTime: "02:40",
        duration: "00:40",
        period: 1,
        playerId: 1,
      },
      {
        startTime: "01:00",
        endTime: "02:10",
        duration: "01:10",
        period: 2,
        playerId: 2,
      },
    ] as any;
    expect(getPairwiseTOI(data, 1, 2)).toEqual(0);
  });
});

describe("sort by line combination", () => {
  test("Game: 2023020850", () => {
    const actual = sortByLineCombination(table, players);
    console.log("Actual Sorted Line Combination:", actual);
    console.log("Expected Sorted Line Combination:", sortedByLineCombination);
    expect(arrayEqual(actual, sortedByLineCombination)).toBe(true);
  });
});

function arrayEqual(
  arrayOne: ReturnType<typeof sortByLineCombination>,
  arrayTwo: ReturnType<typeof sortByLineCombination>
) {
  for (let i = 0; i < arrayTwo.length; i++) {
    if (arrayOne[i].id !== arrayTwo[i].id) return false;
  }

  return true;
}
