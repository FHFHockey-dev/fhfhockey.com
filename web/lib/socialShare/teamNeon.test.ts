import { describe, expect, it } from "vitest";
import { activeTeamAbbreviations, teamsInfo } from "lib/teamsInfo";
import { contrast, NEON_CARD, NEON_MIN_CONTRAST, NEON_MULTICOLOUR, NEON_OVERRIDES, NEON_SINGLE_COLOUR, NEON_SPREADS, teamNeon, withNeonFloor } from "./teamNeon";

describe("team neon colours (TT-11)", () => {
  const teams = [...activeTeamAbbreviations].map(String);

  it("strokes in lightColor and haloes in secondaryColor unless TJ overrode a team (TT-12), all clearing 4.5:1 on the card", () => {
    expect(teams).toHaveLength(32);
    for (const team of teams) {
      const neon = teamNeon(team)!;
      expect(neon.strokeFrom, team).toBe(NEON_OVERRIDES[team]?.stroke ?? "lightColor");
      expect(neon.haloFrom, team).toBe(NEON_OVERRIDES[team]?.halo ?? "secondaryColor");
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

  it("applies TJ's TT-12 choices: VGK gold, accent halos, DAL jersey, dimmer and distinct spreads, every team baked", () => {
    expect(teamNeon("VGK")!.stroke).toBe("#b4975a");
    expect([teamNeon("CHI")!.halo, teamNeon("NYI")!.halo, teamNeon("SJS")!.halo]).toEqual([withNeonFloor("#CC8A00"), "#ffffff", withNeonFloor("#EA7200")]);
    expect(teamNeon("DAL")).toMatchObject({ strokeFrom: "jersey", stroke: withNeonFloor("#006847"), spread: "soft" });
    for (const team of ["BUF", "CBJ", "CHI", "DAL", "DET", "MTL", "NYR", "OTT"]) expect(teamNeon(team)!.spread, team).toBe("soft");
    for (const team of ["COL", "EDM", "FLA", "LAK", "MIN", "STL", "TBL", "TOR", "WSH"]) {
      const neon = teamNeon(team)!;
      expect(neon.spread, team).toBe("distinct");
      expect(neon.halo, team).not.toBe(neon.stroke);
    }
    // Dimmer means a smaller, fainter glow; distinct keeps the halo no wider but lets its colour show.
    expect(NEON_SPREADS.soft.glowPx).toBeLessThan(NEON_SPREADS.normal.glowPx);
    expect(NEON_SPREADS.soft.haloAlpha).toBeLessThan(NEON_SPREADS.normal.haloAlpha);
    expect(NEON_SPREADS.distinct.haloPx).toBeLessThanOrEqual(NEON_SPREADS.normal.haloPx);
    expect(NEON_SPREADS.distinct.glowAlpha).toBeLessThan(NEON_SPREADS.normal.glowAlpha);
    // Add-on (TJ): every team is baked multi-colour except the recorded single-colour fallbacks.
    expect(Object.keys(NEON_SINGLE_COLOUR)).toEqual(["TBL"]);
    expect(NEON_MULTICOLOUR.size).toBe(31);
    for (const team of teams) expect(NEON_MULTICOLOUR.has(team), team).toBe(!(team in NEON_SINGLE_COLOUR));
    for (const team of teams) expect(teamNeon(team)!.multicolour, team).toBe(NEON_MULTICOLOUR.has(team));
  });
});
