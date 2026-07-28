import { describe, expect, it } from "vitest";

import {
  buildGameAxisTicks,
  getAvailableSeasonGameRange,
} from "./chartUtils";

describe("Team standings chart season range", () => {
  it("keeps a complete regular-season series through game 82", () => {
    const series = [
      Array.from({ length: 83 }, (_, gamesPlayed) => ({
        gamesPlayed,
        conference: "E",
        division: "Atlantic",
      })),
    ];

    expect(getAvailableSeasonGameRange(series)).toBe(82);
    expect(buildGameAxisTicks(82).at(-1)).toBe(82);
  });

  it("ends an early-season chart at the latest available game", () => {
    const series = [
      Array.from({ length: 32 }, (_, gamesPlayed) => ({
        gamesPlayed,
        conference: "W",
        division: "Pacific",
      })),
    ];

    expect(getAvailableSeasonGameRange(series)).toBe(31);
    expect(buildGameAxisTicks(31)).toEqual([0, 10, 20, 31]);
    expect(Math.max(...buildGameAxisTicks(31))).toBe(31);
  });

  it("derives the range from the active conference and division", () => {
    const series = [
      [
        { gamesPlayed: 0, conference: "E", division: "Atlantic" },
        { gamesPlayed: 82, conference: "E", division: "Atlantic" },
      ],
      [
        { gamesPlayed: 0, conference: "W", division: "Central" },
        { gamesPlayed: 47, conference: "W", division: "Central" },
      ],
    ];

    expect(getAvailableSeasonGameRange(series, "W", "Central")).toBe(47);
  });
});
