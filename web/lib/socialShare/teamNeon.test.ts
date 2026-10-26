import { describe, expect, it } from "vitest";
import { activeTeamAbbreviations, teamsInfo } from "lib/teamsInfo";
import { contrast, NEON_CARD, NEON_MIN_CONTRAST, teamNeon, withNeonFloor } from "./teamNeon";

describe("team neon colours (TT-11)", () => {
  const teams = [...activeTeamAbbreviations].map(String);

  it("strokes in lightColor and haloes in secondaryColor, both clearing 4.5:1 on the card", () => {
    expect(teams).toHaveLength(32);
    for (const team of teams) {
      const neon = teamNeon(team)!;
      expect(neon.strokeFrom, team).toBe("lightColor");
      for (const color of [neon.stroke, neon.halo]) expect(contrast(color, NEON_CARD), `${team} ${color}`).toBeGreaterThanOrEqual(NEON_MIN_CONTRAST);
    }
  });

  it("keeps colours that already glow, and lifts navy and black by lightness only (hue kept)", () => {
    expect(withNeonFloor("#DFC16C")).toBe("#dfc16c");
    expect(withNeonFloor("#ffffff")).toBe("#ffffff");
    const navy = withNeonFloor("#00205B");
    expect(contrast(navy, NEON_CARD)).toBeGreaterThanOrEqual(NEON_MIN_CONTRAST);
    expect(parseInt(navy.slice(5, 7), 16)).toBeGreaterThan(parseInt(navy.slice(1, 3), 16));
    expect(withNeonFloor("#000000")).toMatch(/^#([0-9a-f]{2})\1\1$/);
    expect(contrast(withNeonFloor("#000000"), NEON_CARD)).toBeLessThan(NEON_MIN_CONTRAST + 0.1);
  });

  it("falls back to primaryColor when a team has no lightColor, and knows no unknown team", () => {
    const tor = teamsInfo.TOR, light = tor.lightColor;
    try {
      delete tor.lightColor;
      expect(teamNeon("TOR")).toMatchObject({ strokeFrom: "primaryColor", stroke: withNeonFloor("#00205B") });
    } finally { tor.lightColor = light; }
    expect(teamNeon("XXX")).toBeNull();
  });
});
