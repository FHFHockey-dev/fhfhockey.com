import { describe, expect, it } from "vitest";

import {
  buildStrengthContext,
  classifyTeamStrengthState,
  formatStrengthExact,
  getEventOwnerSide,
  isEmptyNetSituation,
  parseSituationCode,
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

  it("classifies empty-net states as EN regardless of skater advantage", () => {
    const awayEmptyNet = parseSituationCode("0651");
    const homeEmptyNet = parseSituationCode("1560");

    expect(isEmptyNetSituation(awayEmptyNet)).toBe(true);
    expect(isEmptyNetSituation(homeEmptyNet)).toBe(true);
    expect(formatStrengthExact(awayEmptyNet)).toBe("6v5");
    expect(formatStrengthExact(homeEmptyNet)).toBe("5v6");
    expect(classifyTeamStrengthState(awayEmptyNet, 2, 1, 2)).toBe("EN");
    expect(classifyTeamStrengthState(homeEmptyNet, 1, 1, 2)).toBe("EN");
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
