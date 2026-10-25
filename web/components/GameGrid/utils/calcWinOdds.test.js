import { describe, expect, test } from "vitest";

import { formatWinOdds, isBackToBack } from "./calcWinOdds";

test("format winOdds", () => {
  expect(formatWinOdds(75)).toEqual("75.0%");
  expect(formatWinOdds(25)).toEqual("25.0%");
});

describe("Back to back", () => {
  // [winOddsList, expected isBackToBack for indexes 0,1,2,4,5,6]
  test.each([
    ["begin", [3, 0.3, null, 0.3, 6.4, null, 2.7], [false, true, false, true, false, false]],
    ["middle", [null, 0.3, null, 0.3, 6.4, null, 2.7], [false, false, false, true, false, false]],
    ["end", [null, 0.3, null, 0.3, null, 1, 2.7], [false, false, false, false, false, true]],
  ])("Back to back, %s", (_name, list, expected) => {
    const days = [0, 1, 2, 4, 5, 6];
    expect(days.map((d) => isBackToBack(list, d))).toEqual(expected);
  });
});
