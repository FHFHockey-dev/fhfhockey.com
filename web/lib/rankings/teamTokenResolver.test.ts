import { describe, expect, it } from "vitest";

import { resolveTeamTokenFromRows } from "./teamTokenResolver";

const teams = [
  { id: 6, abbreviation: "BOS", name: "Boston Bruins" },
  { id: 9, abbreviation: "DAL", name: "Dallas Stars" },
];

describe("teamTokenResolver", () => {
  it("accepts numeric team ids and attaches display metadata when available", () => {
    expect(resolveTeamTokenFromRows("6", teams)).toMatchObject({
      teamId: 6,
      abbreviation: "BOS",
      name: "Boston Bruins",
      matchedBy: "id",
    });
  });

  it("accepts team abbreviations case-insensitively", () => {
    expect(resolveTeamTokenFromRows("bos", teams)).toMatchObject({
      teamId: 6,
      abbreviation: "BOS",
      matchedBy: "abbreviation",
    });
  });

  it("accepts full team names case-insensitively", () => {
    expect(resolveTeamTokenFromRows("dallas stars", teams)).toMatchObject({
      teamId: 9,
      abbreviation: "DAL",
      matchedBy: "name",
    });
  });

  it("treats empty team input as no filter", () => {
    expect(resolveTeamTokenFromRows("", teams)).toBeNull();
    expect(resolveTeamTokenFromRows("   ", teams)).toBeNull();
    expect(resolveTeamTokenFromRows(null, teams)).toBeNull();
  });

  it("returns null for unknown text team tokens", () => {
    expect(resolveTeamTokenFromRows("BOSX", teams)).toBeNull();
  });
});
