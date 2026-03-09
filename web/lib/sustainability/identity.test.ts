import { describe, expect, it } from "vitest";

import {
  KNOWN_WGO_NAME_VARIANTS,
  normalizePlayerName
} from "./identity";

describe("normalizePlayerName", () => {
  it("normalizes accents and punctuation for name comparisons", () => {
    expect(normalizePlayerName("Martin Fehérváry")).toBe(
      normalizePlayerName("Martin Fehervary")
    );
    expect(normalizePlayerName("Aatu Räty")).toBe(
      normalizePlayerName("Aatu Raty")
    );
  });

  it("keeps known WGO display variants available for manual review", () => {
    expect(KNOWN_WGO_NAME_VARIANTS[8478438]).toBe("Tommy Novak");
    expect(KNOWN_WGO_NAME_VARIANTS[8480813]).toBe("Joe Veleno");
  });
});
