import { describe, expect, it } from "vitest";

import { parseMinimumGamesPlayedInput } from "./goalieFilters";

describe("parseMinimumGamesPlayedInput", () => {
  it("parses trimmed whole numbers", () => {
    expect(parseMinimumGamesPlayedInput(" 12 ", 4)).toEqual({
      minimumGamesPlayed: 12,
      error: null
    });
  });

  it("resets empty input to zero without an error", () => {
    expect(parseMinimumGamesPlayedInput("   ", 7)).toEqual({
      minimumGamesPlayed: 0,
      error: null
    });
  });

  it("preserves the current value when pasted input is invalid", () => {
    expect(parseMinimumGamesPlayedInput("12.5", 7)).toEqual({
      minimumGamesPlayed: 7,
      error: "Enter a whole number."
    });
    expect(parseMinimumGamesPlayedInput("abc", 7)).toEqual({
      minimumGamesPlayed: 7,
      error: "Enter a whole number."
    });
  });
});
