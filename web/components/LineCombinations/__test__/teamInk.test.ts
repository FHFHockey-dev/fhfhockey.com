import { describe, expect, it } from "vitest";
import TEAM_COLORS from "contexts/TeamColorContext/TEAM_COLORS";
import { contrast } from "lib/socialShare/teamNeon";
import { DARK_INK, LIGHT_INK, readableInk } from "../PlayerCard/teamInk";

describe("readableInk", () => {
  it("keeps a team colour that already reads on the card fill", () => {
    // Nashville: white jersey digits on navy.
    expect(readableInk("#041e42", ["#FFFFFF", "#FFb81c"])).toBe("#ffffff");
  });

  it("falls back to white when every team colour fails (Vegas red and gold on grey)", () => {
    expect(contrast("#c8102e", "#333f48")).toBeLessThan(4.5);
    expect(contrast("#b9975b", "#333f48")).toBeLessThan(4.5);
    expect(readableInk("#333F48", ["#C8102E", "#B9975B"])).toBe(LIGHT_INK);
  });

  it("skips a failing colour for the next readable one (Rangers red on blue)", () => {
    expect(readableInk("#0033A0", ["#a20620", "#ffffff"])).toBe("#ffffff");
  });

  it("falls back to near-black on a light fill", () => {
    expect(readableInk("#f4f4f4", ["#ffffff"])).toBe(DARK_INK);
  });

  it("gives every team readable card ink (digits, accents and white labels)", () => {
    const failures = Object.entries(TEAM_COLORS).flatMap(([team, color]) => {
      const number = readableInk(color.primary, [color.jersey, color.secondary]);
      const accent = readableInk(color.primary, [color.secondary, color.jersey]);
      return [number, accent, LIGHT_INK]
        .filter((ink) => contrast(ink, color.primary.toLowerCase()) < 4.5)
        .map((ink) => `${team}: ${ink} on ${color.primary}`);
    });
    expect(failures).toEqual([]);
  });
});
