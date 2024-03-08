import { describe, expect, test } from "vitest";
import { lineCombos_2023020951_2023020970 } from "./LineCombinationsData";
import { convertToLines, getLineChanges } from "../utilities";

describe("getLineChanges", () => {
  test("game 2023020951 vs 2023020970 | team 26", () => {
    const changes = getLineChanges(lineCombos_2023020951_2023020970 as any);
    expect(changes.promotions).toEqual([
      { playerId: 8482155, currentLine: 2, previousLine: 3 },
      { playerId: 8479400, currentLine: 2, previousLine: 3 },
      { playerId: 8479994, currentLine: 2, previousLine: 3 },
    ]);
    expect(changes.demotions).toEqual([
      { playerId: 8477942, currentLine: 3, previousLine: 2 },
      { playerId: 8479675, currentLine: 3, previousLine: 2 },
      { playerId: 8476479, currentLine: 3, previousLine: 2 },
    ]);
  });
});

describe("convertToLines", () => {
  test("game 2023020970 team 26", () => {
    const input = {
      forwards: [
        8482124, 8471685, 8481532, 8477942, 8479675, 8476479, 8482155, 8479400,
        8479994, 8473453, 8481481,
      ],
      defensemen: [
        8474563, 8479421, 8478882, 8478911, 8477971, 8481606, 8482730,
      ],
      goalies: [8479496, 8475660],
    };
    const expectedResult = {
      forwards: {
        line1: [8482124, 8471685, 8481532],
        line2: [8477942, 8479675, 8476479],
        line3: [8482155, 8479400, 8479994],
        line4: [8473453, 8481481],
      },
      defensemen: {
        line1: [8474563, 8479421],
        line2: [8478882, 8478911],
        line3: [8477971, 8481606],
      },
      goalies: {
        line1: [8479496],
        line2: [8475660],
      },
    };
    expect(convertToLines(input)).toEqual(expectedResult);
  });

  test("game 2023020974 team 22", () => {
    const input = {
      gameId: 2023020974,
      teamId: 22,
      forwards: [
        8477934, 8475786, 8478402, 8475169, 8476454, 8477406, 8477998, 8480802,
        8470621, 8482077, 8474040, 8477015,
      ],
      defensemen: [8475218, 8480803, 8477498, 8479576, 8476879, 8476967],
      goalies: [8475717, 8479973],
    };

    const expectedResult = {
      forwards: {
        line1: [8477934, 8475786, 8478402],
        line2: [8475169, 8476454, 8477406],
        line3: [8477998, 8480802, 8470621],
        line4: [8482077, 8474040, 8477015],
      },
      defensemen: {
        line1: [8475218, 8480803],
        line2: [8477498, 8479576],
        line3: [8476879, 8476967],
      },
      goalies: {
        line1: [8475717],
        line2: [8479973],
      },
    };

    expect(convertToLines(input)).toEqual(expectedResult);
  });
});
