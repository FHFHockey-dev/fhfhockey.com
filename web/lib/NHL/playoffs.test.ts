import { describe, expect, it } from "vitest";

import { shouldShowPlayoffSnapshot } from "./playoffs";

const season = {
  regularSeasonEndDate: "2026-04-16",
  seasonEndDate: "2026-06-24",
};

describe("shouldShowPlayoffSnapshot", () => {
  it("shows the bracket throughout the active postseason", () => {
    expect(
      shouldShowPlayoffSnapshot({
        season,
        isOffseason: false,
        openingNightDate: null,
        now: new Date("2026-05-10T16:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("keeps the completed bracket until an authoritative opening date exists", () => {
    const now = new Date("2026-07-10T16:00:00.000Z");

    expect(
      shouldShowPlayoffSnapshot({
        season,
        isOffseason: true,
        openingNightDate: null,
        now,
      }),
    ).toBe(true);
    expect(
      shouldShowPlayoffSnapshot({
        season,
        isOffseason: true,
        openingNightDate: "2026-09-29",
        now,
      }),
    ).toBe(false);
  });
});
