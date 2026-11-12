import { describe, expect, it } from "vitest";

import {
  classifyTeamManpower,
  parseSituationCode,
} from "lib/supabase/Upserts/nhlStrengthState";

import { PLAYER_STATS_STRENGTHS, type PlayerStatsStrength } from "./playerStatsTypes";
import {
  matchesUnderlyingScoreState,
  matchesUnderlyingStrength,
} from "./underlyingStrengthPredicate";

// Situation code digits: away goalie, away skaters, home skaters, home goalie.
const splitsFor = (code: string, side: "home" | "away") =>
  PLAYER_STATS_STRENGTHS.filter((strength: PlayerStatsStrength) =>
    matchesUnderlyingStrength(strength, classifyTeamManpower(parseSituationCode(code), side))
  ).sort();

describe("matchesUnderlyingStrength (decision 70, oriented fixtures)", () => {
  it("files a home power play (1451) as home PP and away PK", () => {
    expect(splitsFor("1451", "home")).toEqual(["allStrengths", "fiveOnFourPP", "powerPlay"].sort());
    expect(splitsFor("1451", "away")).toEqual(["allStrengths", "fourOnFivePK", "penaltyKill"].sort());
  });

  it("treats 6v5 with no penalty as even strength plus an empty-net attribute, not PP", () => {
    // Home goalie pulled at 5v5: 1560.
    expect(splitsFor("1560", "home")).toEqual(["allStrengths", "evenStrength", "withEmptyNet"].sort());
    expect(splitsFor("1560", "away")).toEqual(["againstEmptyNet", "allStrengths", "evenStrength"].sort());
  });

  it("keeps a pulled goalie during a real home PP a PP (1460) but not the exact 5v4 split", () => {
    expect(splitsFor("1460", "home")).toEqual(["allStrengths", "powerPlay", "withEmptyNet"].sort());
    expect(splitsFor("1460", "away")).toEqual(["againstEmptyNet", "allStrengths", "penaltyKill"].sort());
  });

  it("4v4 and 3v3 are even strength", () => {
    expect(splitsFor("1441", "home")).toEqual(["allStrengths", "evenStrength"].sort());
    expect(splitsFor("1331", "away")).toEqual(["allStrengths", "evenStrength", "threeOnThree"].sort());
  });

  it("a penalty shot or unknown code only counts toward all strengths", () => {
    expect(splitsFor("0101", "home")).toEqual(["allStrengths"]);
    expect(matchesUnderlyingStrength("evenStrength", null)).toBe(false);
  });
});

describe("matchesUnderlyingScoreState (decision 11)", () => {
  it("leading/trailing include one-goal margins; up one/down one are subsets; unknown is only all scores", () => {
    expect(matchesUnderlyingScoreState("leading", 1)).toBe(true);
    expect(matchesUnderlyingScoreState("upOne", 1)).toBe(true);
    expect(matchesUnderlyingScoreState("upOne", 2)).toBe(false);
    expect(matchesUnderlyingScoreState("trailing", -1)).toBe(true);
    expect(matchesUnderlyingScoreState("tied", null)).toBe(false);
    expect(matchesUnderlyingScoreState("allScores", null)).toBe(true);
  });
});
