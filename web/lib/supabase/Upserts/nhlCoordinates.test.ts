import { describe, expect, it } from "vitest";

import {
  getTeamAttackingSide,
  normalizeCoordinatesToAttackingDirection,
  OFFENSIVE_NET_X,
  OFFENSIVE_NET_Y,
} from "./nhlCoordinates";

describe("nhlCoordinates", () => {
  it("keeps home-team coordinates unchanged when home is attacking right", () => {
    const normalized = normalizeCoordinatesToAttackingDirection(68, 12, {
      homeTeamDefendingSide: "left",
      teamSide: "home",
    });

    expect(getTeamAttackingSide("left", "home")).toBe("right");
    expect(normalized).toEqual({
      rawX: 68,
      rawY: 12,
      normalizedX: 68,
      normalizedY: 12,
      isMirrored: false,
      attackingSide: "right",
      attackingNetX: OFFENSIVE_NET_X,
      attackingNetY: OFFENSIVE_NET_Y,
    });
  });

  it("mirrors away-team coordinates when away is attacking left", () => {
    const normalized = normalizeCoordinatesToAttackingDirection(68, 12, {
      homeTeamDefendingSide: "left",
      teamSide: "away",
    });

    expect(getTeamAttackingSide("left", "away")).toBe("left");
    expect(normalized).toEqual({
      rawX: 68,
      rawY: 12,
      normalizedX: -68,
      normalizedY: -12,
      isMirrored: true,
      attackingSide: "left",
      attackingNetX: OFFENSIVE_NET_X,
      attackingNetY: OFFENSIVE_NET_Y,
    });
  });

  it("mirrors home-team coordinates when home is attacking left", () => {
    const normalized = normalizeCoordinatesToAttackingDirection(-55, 8, {
      homeTeamDefendingSide: "right",
      teamSide: "home",
    });

    expect(getTeamAttackingSide("right", "home")).toBe("left");
    expect(normalized).toEqual({
      rawX: -55,
      rawY: 8,
      normalizedX: 55,
      normalizedY: -8,
      isMirrored: true,
      attackingSide: "left",
      attackingNetX: OFFENSIVE_NET_X,
      attackingNetY: OFFENSIVE_NET_Y,
    });
  });

  it("returns null normalized coordinates when the side context is unavailable", () => {
    expect(
      normalizeCoordinatesToAttackingDirection(10, -4, {
        homeTeamDefendingSide: null,
        teamSide: "home",
      })
    ).toEqual({
      rawX: 10,
      rawY: -4,
      normalizedX: null,
      normalizedY: null,
      isMirrored: null,
      attackingSide: null,
      attackingNetX: null,
      attackingNetY: null,
    });

    expect(
      normalizeCoordinatesToAttackingDirection(null, 5, {
        homeTeamDefendingSide: "left",
        teamSide: "away",
      })
    ).toEqual({
      rawX: null,
      rawY: 5,
      normalizedX: null,
      normalizedY: null,
      isMirrored: null,
      attackingSide: "left",
      attackingNetX: OFFENSIVE_NET_X,
      attackingNetY: OFFENSIVE_NET_Y,
    });
  });
});
