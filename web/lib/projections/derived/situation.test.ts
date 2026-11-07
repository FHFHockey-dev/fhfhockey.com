import { describe, expect, it } from "vitest";
import {
  isShootoutPlay,
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

  it("labels every valid situation code by effective skaters (pulled goalie = extra attacker)", () => {
    const HOME = 1;
    const AWAY = 2;
    const effective = (skaters: number, goalie: number) =>
      skaters - (goalie === 1 ? 0 : 1);
    let checked = 0;
    for (const ag of [0, 1])
      for (let as = 0; as <= 6; as += 1)
        for (let hs = 0; hs <= 6; hs += 1)
          for (const hg of [0, 1]) {
            const code = `${ag}${as}${hs}${hg}`;
            const digits = parseSituationDigits(code);
            if (!digits) throw new Error(`Expected ${code} to parse`);
            const home = effective(hs, hg);
            const away = effective(as, ag);
            const expectedHome = home > away ? "pp" : home < away ? "pk" : "es";
            const expectedAway = away > home ? "pp" : away < home ? "pk" : "es";
            expect([code, strengthForTeam(digits, HOME, HOME, AWAY)]).toEqual([
              code,
              expectedHome,
            ]);
            expect([code, strengthForTeam(digits, AWAY, HOME, AWAY)]).toEqual([
              code,
              expectedAway,
            ]);
            checked += 1;
          }
    expect(checked).toBe(2 * 7 * 7 * 2);
  });

  it.each([
    // code, home strength, away strength, why
    ["1551", "es", "es", "5v5"],
    ["1541", "pk", "pp", "away 5v4"],
    ["1451", "pp", "pk", "home 5v4"],
    ["1531", "pk", "pp", "away 5v3"],
    ["1441", "es", "es", "4v4"],
    ["1560", "es", "es", "home goalie pulled 6v5 (extra attacker)"],
    ["0651", "es", "es", "away goalie pulled 6v5 (extra attacker)"],
    ["0641", "pk", "pp", "away pulls goalie during its 5v4: 6v4 is still PP"],
    ["1550", "pk", "pp", "shorthanded home pulls goalie: away PP into empty net"],
    ["1450", "es", "es", "home goalie pulled at 4v4 overtime"],
    ["0101", "es", "es", "penalty-shot / shootout shape is never PP"],
  ])("labels %s as home %s / away %s (%s)", (code, home, away) => {
    const digits = parseSituationDigits(code);
    if (!digits) throw new Error("Expected valid situation digits");
    expect(strengthForTeam(digits, 1, 1, 2)).toBe(home);
    expect(strengthForTeam(digits, 2, 1, 2)).toBe(away);
  });

  it("detects shootout attempts by period type or by period 5+ outside the playoffs", () => {
    expect(
      isShootoutPlay({ gameid: 2026020239, periodnumber: 5, periodtype: "SO" }),
    ).toBe(true);
    expect(
      isShootoutPlay({ gameid: 2026020239, periodnumber: 5, periodtype: null }),
    ).toBe(true);
    expect(
      isShootoutPlay({ gameid: 2026010012, periodnumber: 5, periodtype: null }),
    ).toBe(true);
    expect(
      isShootoutPlay({ gameid: 2026020239, periodnumber: 4, periodtype: "OT" }),
    ).toBe(false);
    expect(
      isShootoutPlay({ gameid: 2026020239, periodnumber: 3, periodtype: "REG" }),
    ).toBe(false);
    // Playoff period 5 is the second overtime, not a shootout.
    expect(
      isShootoutPlay({ gameid: 2026030111, periodnumber: 5, periodtype: "OT" }),
    ).toBe(false);
  });
});
