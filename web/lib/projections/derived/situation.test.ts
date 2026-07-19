import { describe, expect, it } from "vitest";
import {
  parseSituationDigits,
  strengthForTeam,
} from "lib/projections/derived/situation";

describe("situationCode parsing + strength mapping", () => {
  it("parses NHL situationCode as AG/AS/HS/HG", () => {
    const digits = parseSituationDigits("1551");
    expect(digits).toEqual({
      awayGoalie: 1,
      awaySkaters: 5,
      homeSkaters: 5,
      homeGoalie: 1,
    });
  });

  it("maps 5v5 to ES for both teams", () => {
    const digits = parseSituationDigits("1551");
    expect(digits).not.toBeNull();
    if (!digits) throw new Error("Expected valid situation digits");
    expect(strengthForTeam(digits, 1, 1, 2)).toBe("es"); // home
    expect(strengthForTeam(digits, 2, 1, 2)).toBe("es"); // away
  });

  it("maps 5v4 to PP for advantaged team and PK for disadvantaged team", () => {
    const digits = parseSituationDigits("1541"); // away 5, home 4
    expect(digits).not.toBeNull();
    if (!digits) throw new Error("Expected valid situation digits");
    expect(strengthForTeam(digits, 2, 1, 2)).toBe("pp"); // away
    expect(strengthForTeam(digits, 1, 1, 2)).toBe("pk"); // home
  });

  it("rejects missing, non-digit, and out-of-range situation codes", () => {
    expect(parseSituationDigits(null)).toBeNull();
    expect(parseSituationDigits("1x51")).toBeNull();
    expect(parseSituationDigits("1751")).toBeNull();
    expect(parseSituationDigits("2551")).toBeNull();
  });
});
