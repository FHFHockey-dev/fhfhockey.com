import { describe, expect, it } from "vitest";
import { parseSituationDigits, strengthForTeam } from "lib/projections/derived/situation";

describe("situationCode parsing + strength mapping", () => {
  it("parses NHL situationCode as AG/AS/HS/HG", () => {
    const digits = parseSituationDigits("1551");
    expect(digits).toEqual({ awayGoalie: 1, awaySkaters: 5, homeSkaters: 5, homeGoalie: 1 });
  });

  it("maps 5v5 to ES for both teams", () => {
    const digits = parseSituationDigits("1551");
    expect(strengthForTeam(digits, 1, 1, 2)).toBe("es"); // home
    expect(strengthForTeam(digits, 2, 1, 2)).toBe("es"); // away
  });

  it("maps 5v4 to PP for advantaged team and PK for disadvantaged team", () => {
    const digits = parseSituationDigits("1541"); // away 5, home 4
    expect(strengthForTeam(digits, 2, 1, 2)).toBe("pp"); // away
    expect(strengthForTeam(digits, 1, 1, 2)).toBe("pk"); // home
  });
});

