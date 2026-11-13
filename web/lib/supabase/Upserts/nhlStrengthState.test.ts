import { describe, expect, it } from "vitest";

import {
  buildStrengthContext,
  classifyEventStrengthBucket,
  classifyTeamManpower,
  classifyTeamManpowerById,
  classifyTeamStrengthState,
  formatStrengthExact,
  getEventOwnerSide,
  isEmptyNetSituation,
  isPenaltyShotSituation,
  orientStrengthExact,
  parseSituationCode,
  type EventOwnerSide,
  type StrengthBucket,
} from "./nhlStrengthState";

describe("nhlStrengthState", () => {
  it("parses the validated AG/AS/HS/HG situationCode format", () => {
    expect(parseSituationCode("1551")).toEqual({
      raw: "1551",
      awayGoalie: 1,
      awaySkaters: 5,
      homeSkaters: 5,
      homeGoalie: 1,
    });

    expect(parseSituationCode("1331")).toEqual({
      raw: "1331",
      awayGoalie: 1,
      awaySkaters: 3,
      homeSkaters: 3,
      homeGoalie: 1,
    });
  });

  it("classifies even-strength regulation and overtime states as EV", () => {
    const regulation = parseSituationCode("1551");
    const overtime = parseSituationCode("1331");

    expect(formatStrengthExact(regulation)).toBe("5v5");
    expect(formatStrengthExact(overtime)).toBe("3v3");
    expect(classifyTeamStrengthState(regulation, 1, 1, 2)).toBe("EV");
    expect(classifyTeamStrengthState(regulation, 2, 1, 2)).toBe("EV");
    expect(classifyTeamStrengthState(overtime, 1, 1, 2)).toBe("EV");
    expect(classifyTeamStrengthState(overtime, 2, 1, 2)).toBe("EV");
  });

  it("classifies event-owner-relative PP and SH states correctly", () => {
    const awayAdvantage = parseSituationCode("1541");
    const homeAdvantage = parseSituationCode("1451");

    expect(classifyTeamStrengthState(awayAdvantage, 2, 1, 2)).toBe("PP");
    expect(classifyTeamStrengthState(awayAdvantage, 1, 1, 2)).toBe("SH");
    expect(classifyTeamStrengthState(homeAdvantage, 1, 1, 2)).toBe("PP");
    expect(classifyTeamStrengthState(homeAdvantage, 2, 1, 2)).toBe("SH");
  });

  it("labels EN only for the team attacking an empty net (decision 84)", () => {
    // 0651: away (team 2) pulled its goalie for a sixth skater, no penalty.
    const awayEmptyNet = parseSituationCode("0651");
    // 1560: home (team 1) pulled its goalie for a sixth skater, no penalty.
    const homeEmptyNet = parseSituationCode("1560");

    expect(isEmptyNetSituation(awayEmptyNet)).toBe(true);
    expect(isEmptyNetSituation(homeEmptyNet)).toBe(true);
    expect(formatStrengthExact(awayEmptyNet)).toBe("6v5");
    expect(formatStrengthExact(homeEmptyNet)).toBe("5v6");
    // The team with its own net empty keeps its manpower state (ES here).
    expect(classifyTeamStrengthState(awayEmptyNet, 2, 1, 2)).toBe("EV");
    expect(classifyTeamStrengthState(homeEmptyNet, 1, 1, 2)).toBe("EV");
    // The team shooting at the empty net is EN.
    expect(classifyTeamStrengthState(awayEmptyNet, 1, 1, 2)).toBe("EN");
    expect(classifyTeamStrengthState(homeEmptyNet, 2, 1, 2)).toBe("EN");
  });

  describe("classifyTeamManpower (decision 70)", () => {
    it("1560: 6v5 with no penalty is ES with an overlapping empty-net attribute", () => {
      const home = classifyTeamManpower(parseSituationCode("1560"), "home");
      const away = classifyTeamManpower(parseSituationCode("1560"), "away");

      expect(home).toMatchObject({
        manpowerState: "ES",
        teamSkaters: 6,
        opponentSkaters: 5,
        ownNetEmpty: true,
        opponentNetEmpty: false,
        strengthExactTeamFirst: "6v5",
      });
      expect(away).toMatchObject({
        manpowerState: "ES",
        ownNetEmpty: false,
        opponentNetEmpty: true,
        strengthExactTeamFirst: "5v6",
      });
    });

    it("1460: a real home PP with the home goalie pulled stays PP / PK", () => {
      const situation = parseSituationCode("1460");
      expect(classifyTeamManpower(situation, "home")).toMatchObject({
        manpowerState: "PP",
        teamPenaltyStrength: 5,
        opponentPenaltyStrength: 4,
        ownNetEmpty: true,
      });
      expect(classifyTeamManpower(situation, "away")).toMatchObject({
        manpowerState: "PK",
        opponentNetEmpty: true,
      });
      // Legacy labels: the advantaged team keeps PP; the PK team attacks an
      // empty net only if it is shooting, so it is EN.
      expect(classifyTeamStrengthState(situation, 1, 1, 2)).toBe("PP");
      expect(classifyTeamStrengthState(situation, 2, 1, 2)).toBe("EN");
    });

    it("0551: the away PK team pulled its goalie (4 + extra attacker) and stays PK", () => {
      const situation = parseSituationCode("0551");
      expect(classifyTeamManpower(situation, "away")).toMatchObject({
        manpowerState: "PK",
        teamSkaters: 5,
        teamPenaltyStrength: 4,
        ownNetEmpty: true,
      });
      expect(classifyTeamManpower(situation, "home")).toMatchObject({
        manpowerState: "PP",
        opponentNetEmpty: true,
      });
    });

    it("4v4 and 3v3 without a penalty advantage are ES; 4v3 in OT is PP", () => {
      for (const code of ["1441", "1331"]) {
        expect(classifyTeamManpower(parseSituationCode(code), "home")?.manpowerState).toBe("ES");
        expect(classifyTeamManpower(parseSituationCode(code), "away")?.manpowerState).toBe("ES");
      }
      // 1341: away 3, home 4 -> home PP in a 3v3 overtime.
      expect(classifyTeamManpower(parseSituationCode("1341"), "home")?.manpowerState).toBe("PP");
      expect(classifyTeamManpower(parseSituationCode("1341"), "away")?.manpowerState).toBe("PK");
    });

    it("1010 / 0101 penalty shots are not empty net and have no manpower state", () => {
      for (const code of ["1010", "0101"]) {
        const situation = parseSituationCode(code);
        expect(isPenaltyShotSituation(situation)).toBe(true);
        expect(isEmptyNetSituation(situation)).toBe(false);
        for (const side of ["home", "away"] as const) {
          expect(classifyTeamManpower(situation, side)).toMatchObject({
            manpowerState: null,
            ownNetEmpty: false,
            opponentNetEmpty: false,
            isPenaltyShot: true,
          });
        }
        expect(classifyTeamStrengthState(situation, 1, 1, 2)).toBeNull();
        expect(classifyTeamStrengthState(situation, 2, 1, 2)).toBeNull();
      }
    });

    describe("classifyEventStrengthBucket (decision 149, AF-07)", () => {
      it.each<[string, EventOwnerSide]>([
        ["1010", "home"], // home shooter, away goalie in
        ["0101", "away"], // away shooter, home goalie in
      ])(
        "%s penalty shot (%s shooter) belongs to no strength bucket",
        (code, shooter) => {
          const digits = parseSituationCode(code)!;
          const defender = shooter === "home" ? "away" : "home";
          expect(classifyEventStrengthBucket(digits, shooter)).toBeNull();
          expect(classifyEventStrengthBucket(digits, defender)).toBeNull();
        }
      );

      it.each<[string, StrengthBucket, StrengthBucket, string]>([
        // code, home bucket, away bucket, why
        ["1551", "es", "es", "5v5"],
        ["1451", "pp", "pk", "home 5v4"],
        ["1541", "pk", "pp", "away 5v4"],
        ["1531", "pk", "pp", "away 5v3"],
        ["1441", "es", "es", "4v4"],
        ["1331", "es", "es", "3v3 overtime"],
        ["1341", "pp", "pk", "home 4v3 overtime"],
        ["1560", "es", "es", "home extra attacker, no penalty"],
        ["0641", "pk", "pp", "away pulls goalie during its 5v4"],
        ["1550", "pk", "pp", "shorthanded home pulls goalie"],
      ])("keeps %s as home %s / away %s (%s)", (code, home, away) => {
        const digits = parseSituationCode(code)!;
        expect(classifyEventStrengthBucket(digits, "home")).toBe(home);
        expect(classifyEventStrengthBucket(digits, "away")).toBe(away);
      });

      it("is the canonical manpower state, lower-cased, for every code and side", () => {
        const bucketOf = { ES: "es", PP: "pp", PK: "pk" } as const;
        for (let n = 0; n < 10000; n += 1) {
          const digits = parseSituationCode(String(n).padStart(4, "0"))!;
          for (const side of ["home", "away"] as const) {
            const manpower = classifyTeamManpower(digits, side)!.manpowerState;
            expect(classifyEventStrengthBucket(digits, side)).toBe(
              manpower == null ? null : bucketOf[manpower]
            );
          }
        }
      });
    });

    it("is oriented: the home and away answers are mirror images for every code", () => {
      for (let n = 0; n < 10000; n += 1) {
        const code = String(n).padStart(4, "0");
        const situation = parseSituationCode(code)!;
        const mirrored = parseSituationCode(
          `${code[3]}${code[2]}${code[1]}${code[0]}`
        );
        const home = classifyTeamManpowerById(situation, 1, 1, 2);
        const awayOfMirror = classifyTeamManpowerById(mirrored, 2, 1, 2);
        expect({ ...awayOfMirror, teamSide: "home" }).toEqual(home);
      }
    });

    it("orients the stored away-first strength_exact for a team", () => {
      // Stored "4v5" = away 4, home 5: the home team is on the PP.
      expect(orientStrengthExact("4v5", "home")).toBe("5v4");
      expect(orientStrengthExact("4v5", "away")).toBe("4v5");
      expect(orientStrengthExact("bad", "home")).toBeNull();
      expect(orientStrengthExact(null, "home")).toBeNull();
    });
  });

  it("handles rare manpower states and unknown owners deterministically", () => {
    const rare = parseSituationCode("1431");

    expect(formatStrengthExact(rare)).toBe("4v3");
    expect(classifyTeamStrengthState(rare, 2, 1, 2)).toBe("PP");
    expect(classifyTeamStrengthState(rare, 1, 1, 2)).toBe("SH");
    expect(classifyTeamStrengthState(rare, 999, 1, 2)).toBeNull();
    expect(getEventOwnerSide(999, 1, 2)).toBeNull();
  });

  it("builds a complete context payload for downstream parsers", () => {
    expect(buildStrengthContext(parseSituationCode("1451"), 1, 1, 2)).toEqual({
      strengthExact: "4v5",
      strengthState: "PP",
      eventOwnerSide: "home",
    });

    expect(buildStrengthContext(parseSituationCode("1541"), 1, 1, 2)).toEqual({
      strengthExact: "5v4",
      strengthState: "SH",
      eventOwnerSide: "home",
    });

    expect(buildStrengthContext(parseSituationCode("1551"), null, 1, 2)).toEqual({
      strengthExact: "5v5",
      strengthState: null,
      eventOwnerSide: null,
    });
  });
});
