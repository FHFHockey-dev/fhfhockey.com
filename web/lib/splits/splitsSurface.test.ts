import { describe, expect, it } from "vitest";

import {
  buildSplitTeamOptions,
  normalizeTeamAbbreviation,
  resolveDefaultOpponentAbbreviation,
} from "./splitsSurface";

describe("splitsSurface helpers", () => {
  it("normalizes team abbreviations", () => {
    expect(normalizeTeamAbbreviation(" edm ")).toBe("EDM");
    expect(normalizeTeamAbbreviation("")).toBeNull();
    expect(normalizeTeamAbbreviation(undefined)).toBeNull();
  });

  it("sorts team options alphabetically", () => {
    expect(
      buildSplitTeamOptions([
        { abbreviation: "VAN", name: "Canucks" },
        { abbreviation: "ANA", name: "Ducks" },
      ]).map((team) => team.abbreviation)
    ).toEqual(["ANA", "VAN"]);
  });

  it("resolves the first alphabetical opponent that is not the selected team", () => {
    expect(
      resolveDefaultOpponentAbbreviation({
        selectedTeamAbbreviation: "ANA",
        teamOptions: [
          { abbreviation: "ANA", name: "Ducks" },
          { abbreviation: "BOS", name: "Bruins" },
          { abbreviation: "BUF", name: "Sabres" },
        ],
      })
    ).toBe("BOS");
  });
});
